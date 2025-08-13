// src/games/BlackjackProd.tsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCurrency } from "../context/CurrencyContext";

/* ---------- card helpers ---------- */
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;
const suitOf = (c:number)=> Math.floor(c/13)%4;
const rankOf = (c:number)=> c%13;
const isRed = (s:number)=> s===1 || s===2;

function scoreHand(cards:number[]) {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === 12) { total += 11; aces++; }           // A
    else if (r >= 9) total += 10;                    // 10,J,Q,K
    else total += (r+2);                             // 2..9
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  const soft = aces > 0 && total <= 21;
  return { total, soft };
}

/* ---------- API types ---------- */
type PlaceResp = {
  roundId: string;
  clientSeed: string;
  nonce: number;
  serverSeedHash: string;
  player: number[];
  dealerUp: number;
  canSplit: boolean;
  canDouble: boolean;
  blackjack: boolean;
  canInsurance?: boolean; 
};
type Outcome = "win"|"lose"|"push"|"blackjack";
type SettleResp = {
  serverSeed: string;
  dealer: number[];
  outcomes: { value:number; result:Outcome; payout:number }[];
  totalPayout: number;
  /** optionalno, če backend zaključi takoj po double/hit bust, pošlje še kartico za prikaz */
  playerCard?: number;
};
// ⬇️ dodan active
type HitResp    = { card:number; value:number; bust:boolean; active:number } | SettleResp;
type StandResp  = { ok:true; active:number } | SettleResp;
type DoubleResp = { card:number; value:number } | SettleResp;
type SplitResp  = { hands:number[][]; canDouble:boolean };

/* ---------- UI: Card with deal + flip + fan offsets ---------- */
function Card({
  c,
  revealed = true,
  dealDelay = 0,
  ml = "0em",
  mt = "0em",
}:{
  c: number;
  revealed?: boolean;
  dealDelay?: number;
  ml?: string;  // horizontal overlap (negativen za fan)
  mt?: string;  // vertikalni “step”
}) {
  const front = (() => {
    const s = suitOf(c), r = rankOf(c);
    const color = isRed(s) ? "#ff6b6b" : "#e6f0f7";
    return (
      <div
        className="absolute inset-0 rounded-xl border px-2 py-2 flex flex-col justify-between"
        style={{
          background:"#0b1620",
          borderColor:"#2a4152",
          boxShadow:"inset 0 -2px 0 rgba(0,0,0,.25)",
          backfaceVisibility:"hidden",
          WebkitBackfaceVisibility:"hidden",
          transform:"rotateY(0deg)",
        }}
      >
        <div className="font-bold leading-none" style={{ color }}>{RANKS[r]}</div>
        <div className="text-xl text-center" style={{ color }}>{SUITS[s]}</div>
        <div className="text-right opacity-80 leading-none" style={{ color, fontSize:12 }}>{SUITS[s]}</div>
      </div>
    );
  })();

  const back = (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden border"
      style={{
        borderColor:"#2a4152",
        transform:"rotateY(180deg)",
        backfaceVisibility:"hidden",
        WebkitBackfaceVisibility:"hidden",
      }}
    >
      <img src="/back-card-none.png" alt="Hidden card" className="w-full h-full object-cover" />
    </div>
  );

  return (
    <motion.div
      className="relative w-16 h-24 sm:w-20 sm:h-28"
      initial={{ y:-18, opacity:0, scale:0.9 }}
      animate={{ y:0, opacity:1, scale:1 }}
      transition={{ type:"spring", stiffness:260, damping:20, delay: dealDelay }}
      style={{ perspective: 800, marginLeft: ml, marginTop: mt }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ rotateY: revealed ? 0 : 180 }}
        initial={revealed ? 0 : 180}
        transition={{ duration: 0.45, ease: "easeInOut" }}
        style={{ transformStyle:"preserve-3d", borderRadius: "0.75rem" }}
      >
        {front}
        {back}
      </motion.div>
    </motion.div>
  );
}

/* ---------- Main ---------- */
export default function BlackjackProd({
  onPlaceBet, onHit, onStand, onDouble, onSplit,onInsurance,
  minBet=0, maxBet=1000,
}:{
  minBet?:number; maxBet?:number;
  onPlaceBet:(bet:number, params:{currency:"BTC"|"SOL"}, seeds:{clientSeed:string; nonce:number})=>Promise<PlaceResp>;
  onHit:(roundId:string)=>Promise<HitResp>;
  onStand:(roundId:string)=>Promise<StandResp>;
  onDouble:(roundId:string)=>Promise<DoubleResp|SettleResp>;
  onSplit:(roundId:string)=>Promise<SplitResp>;
  onInsurance?:(roundId:string, take:boolean)=>Promise<{ok:true;insuranceBet:number}>;
}) {
  const { selectedCurrency, adjustBalance } = useCurrency();

  const theme = useMemo(()=>({
    appBg:"#1a2c38", panel:"#0f212e", panelSoft:"#152532", border:"#2a4152",
    text:"#d7e1ea", subtext:"#91a3b0", accent:"#00e701", accentText:"#001b0a",
    win:"#0bbf74", lose:"#e25757", push:"#6c7b86",
  }),[]);

  // bet
  const [bet, setBet] = useState(0);
  const [betField, setBetField] = useState(minBet.toFixed(8));

  // round state
  const [roundId, setRoundId] = useState<string|null>(null);
  const [playerHands, setPlayerHands] = useState<number[][]>([]);
  const [handValues, setHandValues] = useState<{total:number;soft:boolean}[]>([]);
  const [outcomes, setOutcomes] = useState<(Outcome|null)[]>([]);
  const [active, setActive] = useState(0);
  const [dealer, setDealer] = useState<number[]>([]);
  const [canSplit, setCanSplit] = useState(false);
  const [canDouble, setCanDouble] = useState(false);
  const [roundOver, setRoundOver] = useState(false);
  const [finalValues, setFinalValues] = useState<number[] | null>(null);
  const [canInsurance, setCanInsurance] = useState(false);
  const showInsurance = !!roundId && !roundOver && canInsurance;

  // ux locks
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);

  // global lock za bet/inpute med živo rundo
  const betLocked = rolling || busy || (!!roundId && !roundOver);
  
  const [seeds, setSeeds] = useState<{
	  clientSeed: string;
	  nonce: number;
	  serverSeed: string;       // revealed only after settle
	  serverSeedHash: string;   // commitment shown right after place-bet
	}>({
	  clientSeed: "",
	  nonce: 0,
	  serverSeed: "",
	  serverSeedHash: "",
	});

  const clean = () => {
    setRoundId(null);
    setPlayerHands([]);
    setHandValues([]);
    setOutcomes([]);
    setActive(0);
    setDealer([]);
    setCanSplit(false);
    setCanDouble(false);
    setRoundOver(false);
	setFinalValues(null);
	setCanInsurance(false);
  };

  /* -------- PLACE (auto-resolve blackjack) -------- */
  async function place() {
    if (bet !== 0 && (bet < minBet || bet > maxBet)) {
      alert(`Bet must be between ${minBet} in ${maxBet}.`);
      return;
    }
    setRolling(true);
    try {
      const cs = crypto.getRandomValues(new Uint8Array(16)).reduce((a,v)=>a+v.toString(16).padStart(2,"0"),"");
      const resp = await onPlaceBet(
        bet,
        { currency: selectedCurrency as "BTC" | "SOL" },
        { clientSeed: cs, nonce: 1 }
      );
	  
	  setSeeds({
		  clientSeed: resp.clientSeed,
		  nonce: resp.nonce,
		  serverSeed: "",                 // not revealed yet
		  serverSeedHash: resp.serverSeedHash,
		});

      setRoundId(resp.roundId);
      setPlayerHands([resp.player]);
      setHandValues([scoreHand(resp.player)]);
      setDealer([resp.dealerUp, -1]);
      setCanSplit(resp.canSplit);
      setCanDouble(resp.canDouble);
	  setCanInsurance(!!resp.canInsurance);
      setOutcomes([null]);
      setActive(0);
      setRoundOver(false);

      if (bet > 0) adjustBalance(selectedCurrency, -bet);

      if (resp.blackjack) {
	  setCanInsurance(false);      // ⬅️ skrij Insurance takoj
	  setBusy(true);
	  try {
		const fin = await onStand(resp.roundId);
		if ("serverSeed" in fin) settle(fin);		// settle ga bo vseeno še enkrat resetiral
	  } finally {
		setBusy(false);
	  }
	}
    } catch (e:any) {
      alert(e?.message || "place-bet failed");
    } finally {
      setRolling(false);
    }
  }

  /* primarni gumb: Bet / Bet Again */
  async function primaryClick() {
    if (betLocked) return;
    if (roundOver) {
      clean();
      await place();
    } else {
      await place();
    }
  }

  /* -------- Actions -------- */
  const actionDisabled = !roundId || roundOver || busy;

  async function hit() {
    setCanInsurance(false);
    if (!roundId || roundOver) return;
    setBusy(true);
    try {
      const r = await onHit(roundId);

      // 🔚 settle (npr. bust in ni več rok)
      if ("serverSeed" in r) {
        if (r.playerCard != null) {
          setPlayerHands(h => {
            const cp = h.map(x=>x.slice());
            cp[active].push(r.playerCard!);
            return cp;
          });
        }
        settle(r);
        return;
      }

      // ➕ dodaj karto na trenutno roko
      setPlayerHands(prev => {
		  const cp = prev.map(x => x.slice());
		  cp[active].push(r.card);
		  setHandValues(vals => {
			const vv = vals.slice();
			vv[active] = scoreHand(cp[active]); // ✅ izračun iz sveže kopije
			return vv;
		  });
		  return cp;
		});

      // ⬅️ če je bust, backend je že prestavil aktivni indeks → preklopi UI + osveži canDouble
      if (r.bust) {
        setActive(r.active);
        setCanDouble((playerHands[r.active]?.length ?? 2) === 2);
      }
    } catch (e:any) {
      alert(e?.message || "hit failed");
    } finally {
      setBusy(false);
    }
  }

  async function stand() {
    setCanInsurance(false);
    if (!roundId || roundOver) return;
    setBusy(true);
    try {
      const r = await onStand(roundId);
      if ("serverSeed" in r) { settle(r); return; }
      setActive(r.active);
      // 🔄 po preklopu osveži canDouble
      setCanDouble((playerHands[r.active]?.length ?? 2) === 2);
    } catch (e:any) {
      alert(e?.message || "stand failed");
    } finally {
      setBusy(false);
    }
  }

  async function dbl() {
    setCanInsurance(false);
    if (!roundId || roundOver) return;
    setBusy(true);
    try {
      const r = await onDouble(roundId);
      if ("serverSeed" in r) {
        if (r.playerCard != null) {
          setPlayerHands(h => {
            const cp = h.map(x=>x.slice());
            cp[active].push(r.playerCard!);
            return cp;
          });
        }
        settle(r);
        return;
      }
      setPlayerHands(h => {
        const cp = h.map(x=>x.slice());
        cp[active].push(r.card);
        return cp;
      });
      setHandValues(vals => {
        const vv = vals.slice();
        vv[active] = scoreHand([...playerHands[active], r.card]);
        return vv;
      });

      const fin = await onStand(roundId);
      if ("serverSeed" in fin) {
  settle(fin);      // <- this sets seeds.serverSeed for you
  return;
}
    } catch (e:any) {
      alert(e?.message || "double failed");
    } finally {
      setBusy(false);
    }
  }

  async function split() {
    setCanInsurance(false);
    if (!roundId || roundOver) return;
    setBusy(true);
    try {
      const r = await onSplit(roundId);
      setPlayerHands(r.hands);
      setHandValues(r.hands.map(scoreHand));
      setActive(0);
      setCanSplit(false);
      setCanDouble(r.canDouble);
      setOutcomes(new Array(r.hands.length).fill(null));
    } catch (e:any) {
      alert(e?.message || "split failed");
    } finally {
      setBusy(false);
    }
  }
  
  async function takeInsurance(take:boolean) {
  if (!roundId || roundOver || !onInsurance) return;
  try {
    const r = await onInsurance(roundId, take);
    if (!r?.ok) throw new Error("insurance failed");
    if (take && r.insuranceBet > 0) {
      adjustBalance(selectedCurrency, -r.insuranceBet);
    }
  } catch (e:any) {
    alert(e?.message || "insurance failed");
  } finally {
    setCanInsurance(false);
  }
}

  /* -------- Settle -------- */
  function settle(fin: SettleResp) {
	  setDealer(fin.dealer);
	  setOutcomes(fin.outcomes.map(o => o.result));
	  setFinalValues(fin.outcomes.map(o => o.value));  // ⬅️
	  setHandValues(playerHands.map(scoreHand));
	  setRoundOver(true);
	  setCanInsurance(false); 
	  setSeeds(s => ({ ...s, serverSeed: fin.serverSeed }));
	  if (fin.totalPayout > 0) adjustBalance(selectedCurrency, fin.totalPayout);
	}
	
	const badgeText = (i: number) => {
	  const ov = outcomes[i];
	  const live = handValues[i];
	  const val = finalValues?.[i] ?? (live ? live.total : undefined);

	  if (!ov) return live ? `${live.total}${live.soft ? " (soft)" : ""}` : "";
	  if (ov === "blackjack") return "BLACKJACK 21";
	  return `${ov.toUpperCase()} · ${val ?? ""}`;
	};

  /* -------- UI helpers -------- */
  const pill = (t:string) => (
    <div className="px-2 py-0.5 rounded-full text-xs font-semibold"
         style={{ background:"#142431", border:`1px solid ${theme.border}`, color:theme.text }}>
      {t}
    </div>
  );

  // Dealer badge: pokaži vrednost vidnih kart (če je hole skrit → samo up-card)
  const dealerPillText = (() => {
    if (dealer.length === 0) return "Dealer";
    if (dealer[1] >= 0) return String(scoreHand(dealer).total);
    return String(scoreHand([dealer[0]]).total);
  })();

  // fan offseti (casino izgled)
  const fanOffsets = (j: number): { ml: string; mt: string } => {
    const stepEm = 1.0;
    const overlapEm = -2.4;
    return { ml: j === 0 ? "0em" : `${overlapEm}em`, mt: `${j * stepEm}em` };
  };

  /* -------- Left panel -------- */
  const leftPanel =
    <aside className="rounded-xl border h-fit" style={{ backgroundColor:theme.panel, borderColor:theme.border }}>
      <div className="p-4 md:p-5">
        <div className="flex bg-[#0b1a23] rounded-full p-1 mb-4 w-fit">
          <button className="px-4 py-1.5 text-sm rounded-full" style={{ backgroundColor:theme.panel, color:theme.text }}>Manual</button>
          <button className="px-4 py-1.5 text-sm rounded-full text-[#7b8b97]">Auto</button>
        </div>

        <label className="text-xs" style={{ color:theme.subtext }}>Bet Amount</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={betField}
            disabled={betLocked}
            onChange={(e)=> {
              let raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
              const parts = raw.split(".");
              if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
              setBetField(raw);
              const p = parseFloat(raw);
              if (!Number.isNaN(p)) setBet(Math.min(Math.max(p, minBet), maxBet));
            }}
            onBlur={()=> {
              const p = parseFloat(betField.replace(",", "."));
              const v = Number.isNaN(p) ? bet : Math.min(Math.max(p, minBet), maxBet);
              setBet(v); setBetField(v.toFixed(8));
            }}
            className="flex-1 rounded-lg px-3 py-2 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor:theme.panelSoft, borderColor:theme.border, borderWidth:1 }}
          />
          <div className="flex gap-1">
            <button
              onClick={()=> setBet(b=>{ const v=Math.max(minBet, Number((b/2).toFixed(8))); setBetField(v.toFixed(8)); return v; })}
              className="px-2 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor:theme.panelSoft, borderColor:theme.border, borderWidth:1 }}
              disabled={betLocked}
            >½</button>
            <button
              onClick={()=> setBet(b=>{ const v=Math.min(maxBet, Number((b*2).toFixed(8))); setBetField(v.toFixed(8)); return v; })}
              className="px-2 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor:theme.panelSoft, borderColor:theme.border, borderWidth:1 }}
              disabled={betLocked}
            >2×</button>
          </div>
        </div>
        <p className="text-[11px] mt-1" style={{ color:theme.subtext }}>Min {minBet} · Max {maxBet}</p>
		
		{showInsurance && (
		  <div className="mt-3 p-2 rounded-lg flex items-center justify-between"
			   style={{ background:"#142431", border:`1px solid ${theme.border}` }}>
			<div className="text-sm" style={{ color:theme.text }}>
			  Insurance?
			</div>
			<div className="flex gap-2">
			  <button
				onClick={()=> takeInsurance(true)}
				className="px-3 py-1.5 rounded-md text-sm font-semibold"
				style={{ backgroundColor:theme.accent, color:theme.accentText }}
			  >
				Take
			  </button>
			  <button
				onClick={()=> takeInsurance(false)}
				className="px-3 py-1.5 rounded-md text-sm font-semibold"
				style={{ background:"#223442", border:`1px solid ${theme.border}`, color:theme.text }}
			  >
				No Thanks
			  </button>
			</div>
		  </div>
		)}
		
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={actionDisabled} onClick={hit}
                  className="rounded-lg py-2 font-semibold disabled:opacity-50"
                  style={{ background:"#223442", border:`1px solid ${theme.border}` }}>
            Hit
          </button>
          <button disabled={actionDisabled} onClick={stand}
                  className="rounded-lg py-2 font-semibold disabled:opacity-50"
                  style={{ background:"#223442", border:`1px solid ${theme.border}` }}>
            Stand
          </button>
          <button disabled={actionDisabled || !canDouble} onClick={dbl}
                  className="rounded-lg py-2 font-semibold disabled:opacity-50"
                  style={{ background:"#223442", border:`1px solid ${theme.border}` }}>
            Double
          </button>
          <button disabled={actionDisabled || !canSplit} onClick={split}
                  className="rounded-lg py-2 font-semibold disabled:opacity-50"
                  style={{ background:"#223442", border:`1px solid ${theme.border}` }}>
            Split
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={primaryClick}
            disabled={betLocked}
            className="w-full font-semibold rounded-lg py-3 disabled:opacity-60"
            style={{ backgroundColor:theme.accent, color:theme.accentText }}
          >
            {roundOver ? "Bet Again" : (rolling ? "Dealing…" : betLocked ? "Playing…" : "Bet")}
          </button>
        </div>
		{/* Seeds */}
<div className="mt-4 grid grid-cols-1 gap-3">
  <div>
    <label className="text-xs" style={{ color: theme.subtext }}>Client seed</label>
    <input
      readOnly
      type="text"
      value={seeds.clientSeed || "—"}
      className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
      style={{ backgroundColor: theme.panelSoft, borderColor: theme.border, borderWidth: 1 }}
    />
  </div>
  <div>
    <label className="text-xs" style={{ color: theme.subtext }}>Nonce</label>
    <input
      readOnly
      type="number"
      min={1}
      value={seeds.nonce || 0}
      className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
      style={{ backgroundColor: theme.panelSoft, borderColor: theme.border, borderWidth: 1 }}
    />
  </div>
  <div>
    <label className="text-xs" style={{ color: theme.subtext }}>Server seed</label>
    <input
      readOnly
      type="text"
      value={seeds.serverSeed || "—"}   // becomes visible after settle
      className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
      style={{ backgroundColor: theme.panelSoft, borderColor: theme.border, borderWidth: 1 }}
    />
  </div>
</div>

<div className="mt-4 text-[11px]" style={{ color: theme.subtext }}>
  Commitment hash: <span className="font-mono break-all">{seeds.serverSeedHash || "—"}</span>
</div>
      </div>
    </aside>;

  /* -------- Table -------- */
  return (
    <div className="w-full" style={{ backgroundColor:theme.appBg, color:theme.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {leftPanel}

          <div className="rounded-xl px-4 md:px-8 py-6"
               style={{ backgroundColor:theme.panel, border:`1px solid ${theme.border}` }}>
            {/* Dealer */}
            <div className="flex flex-col items-center mb-6 min-h-[200px]">
              <div className="mb-2">{pill(dealerPillText)}</div>
              <div className="flex items-start justify-center">
                {dealer.map((ci,i)=> {
                  const { ml, mt } = fanOffsets(i);
                  return (
                    <Card
                      key={i}
                      c={ci >= 0 ? ci : 0}
                      revealed={ci >= 0}
                      dealDelay={i * 0.08 + 0.04}
                      ml={ml}
                      mt={mt}
                    />
                  );
                })}
              </div>
            </div>

            {/* Banner */}
            <div className="flex justify-center my-4">
              <img src="/bjbg.svg" alt="Blackjack banner" className="w-full max-w-md opacity-90" />
            </div>

            {/* Player hands */}
			<div className="flex flex-col items-center gap-6 min-h-[200px] pt-[50px]">
			  {playerHands.map((h, i) => {
				const ov = outcomes[i];
				const border =
				  ov === "blackjack" ? theme.win :
				  ov === "win"       ? theme.win :
				  ov === "lose"      ? theme.lose :
				  ov === "push"      ? theme.push : theme.border;
				const glow = roundId && !roundOver && i === active;

				return (
				  <div
					key={i}
					className="relative rounded-2xl px-4 py-3"
					style={{
					  border: `2px solid ${border}`,
					  background: glow ? "rgba(32,64,80,.35)" : "rgba(20,36,49,.6)",
					  boxShadow: glow ? "0 0 0 3px rgba(0,231,1,.25)" : "none",
					}}
				  >
					<div className="absolute -top-3 left-1/2 -translate-x-1/2">
					  {badgeText(i) && pill(badgeText(i))}
					</div>

					<div className="flex items-start justify-center">
					  {h.map((ci, j) => {
						const { ml, mt } = fanOffsets(j);
						return (
						  <Card
							key={j}
							c={ci}
							revealed
							dealDelay={j * 0.08 + i * 0.04}
							ml={ml}
							mt={mt}
						  />
						);
					  })}
					</div>
				  </div>
				);
			  })}
			  {!roundId && <div className="opacity-70 text-sm">Place a bet to start</div>}
			</div>
          </div>
        </div>
      </div>
    </div>
  );
}
