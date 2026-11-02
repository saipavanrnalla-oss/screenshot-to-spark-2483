import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteBanner, Panel } from "@/components/ds/primitives";
import { EditFooter } from "@/components/r1/edit-footer";
import { StatusChip, versionTone } from "@/components/r1/status-chip";
import { inputCls, selectCls } from "@/components/r1/tabs";
import { INTERRUPT_NEXT, SECOND_APPROVER_LIMIT, STAGE_LIST, stageUnder, stageValidation, type StageSettings, type Station } from "@/data/persistency/r1/stage-settings";
import { PRODUCTS, type Product, type Stage } from "@/data/persistency";
import { useCan, useUser } from "@/hooks/use-user";
import { usePolicies } from "@/store/persistency";
import { activeVersion, useVersions, useWork } from "@/store/work";
import { date, num } from "@/lib/format";

const KEY = "stage:settings";

function diffLines(a: StageSettings, b: StageSettings): string[] {
  const out: string[] = [];
  const f = (label: string, x: number, y: number, unit = "days") => x !== y && out.push(`${label}: ${x} → ${y} ${unit}`);
  f("Warming starts before due", a.warmingStart, b.warmingStart);
  f("Window opens before due", a.windowOpens, b.windowOpens);
  f("Grace, monthly mode", a.graceMonthly, b.graceMonthly);
  f("Grace, other modes", a.graceOther, b.graceOther);
  f("Lapse boundary", a.lapseBoundary, b.lapseBoundary);
  if (JSON.stringify(a.stations) !== JSON.stringify(b.stations)) out.push(`Warming stations: ${a.stations.length} → ${b.stations.length} rows, offsets ${b.stations.map((s) => `T${s.offset}`).join(", ")}`);
  for (const p of PRODUCTS) if (a.activeByProduct[p].join() !== b.activeByProduct[p].join()) out.push(`${p} stages active: ${b.activeByProduct[p].join(", ")}`);
  if (JSON.stringify(a.interrupts) !== JSON.stringify(b.interrupts)) out.push("Interrupt routing changed");
  for (const p of PRODUCTS) f(`${p} revival window`, a.revivalYears[p], b.revivalYears[p], "years");
  return out;
}

export function StageSettingsEditor() {
  const user = useUser();
  const mayEdit = useCan("stages.edit");
  const versions = useVersions<StageSettings>(KEY);
  const active = activeVersion(versions)!;
  const last = versions[versions.length - 1]!;
  const inReview = versions.find((v) => v.status === "In review");
  const savedDraft = last.status === "Draft" ? last : undefined;
  const base = savedDraft?.data ?? active.data;
  const [draft, setDraft] = useState<StageSettings>(base);
  const [dragId, setDragId] = useState<string | null>(null);
  const work = useWork();
  const policies = usePolicies();

  useEffect(() => setDraft(base), [base]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const problems = stageValidation(draft);
  const affected = useMemo(() => {
    let n = 0;
    const byStage: Partial<Record<Stage, number>> = {};
    for (const p of policies) {
      const a = stageUnder(p, active.data);
      const b = stageUnder(p, draft);
      if (a !== b) {
        n++;
        byStage[b] = (byStage[b] ?? 0) + 1;
      }
    }
    return { n, byStage };
  }, [policies, draft, active.data]);

  const locked = !mayEdit || !!inReview;
  const num0 = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const set = (patch: Partial<StageSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const setStation = (id: string, patch: Partial<Station>) => set({ stations: draft.stations.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const save = () => {
    const no = work.saveDraft(KEY, draft, user?.name ?? "User", "Stage settings change");
    toast.success(`Saved as draft version ${no}`);
  };
  const submit = () => {
    const no = savedDraft && !dirty ? savedDraft.no : work.saveDraft(KEY, draft, user?.name ?? "User", "Stage settings change");
    const second = affected.n > SECOND_APPROVER_LIMIT;
    work.submit({
      kind: "stage",
      objectId: "settings",
      objectName: "Stage settings",
      versionNo: no,
      requestedBy: user?.name ?? "User",
      summary: `Stage settings version ${no}: ${num(affected.n)} policies change stage`,
      reach: affected.n,
      diff: diffLines(active.data, draft),
      conflicts: [],
      needs: second ? ["head", "compliance"] : ["head"],
      secondApproverReason: second ? `Moves more than ${num(SECOND_APPROVER_LIMIT)} policies between stages` : undefined,
    });
    toast.success(`Version ${no} sent for review`, { description: second ? "Needs a second approver: more than 5,000 policies move." : "Waiting for Head of Persistency." });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-muted-foreground">In force:</span>
        <StatusChip tone="ok">Version {active.no} Active</StatusChip>
        {active.effectiveFrom && <span className="text-muted-foreground">from {date(active.effectiveFrom)}</span>}
        {savedDraft && <StatusChip tone={versionTone("Draft")}>Version {savedDraft.no} Draft</StatusChip>}
        {inReview && <StatusChip tone={versionTone("In review")}>Version {inReview.no} In review</StatusChip>}
      </div>
      {savedDraft?.returnReason && <NoteBanner tone="attention">Returned by the approver: {savedDraft.returnReason}</NoteBanner>}
      {inReview && <NoteBanner>Version {inReview.no} is waiting for approval. Editing opens again after it is approved or returned.</NoteBanner>}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel title="Stage boundaries">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["warmingStart", "Warming starts (days before due)"],
                  ["windowOpens", "Window opens (days before due)"],
                  ["graceMonthly", "End of grace, monthly (days)"],
                  ["graceOther", "End of grace, other modes (days)"],
                  ["lapseBoundary", "Early to late lapse (days)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block text-[12px] font-medium text-muted-foreground">
                  {label}
                  <input type="number" disabled={locked} value={draft[k]} onChange={(e) => set({ [k]: num0(e.target.value) } as Partial<StageSettings>)} className={`${inputCls} mt-1 tabular`} />
                </label>
              ))}
            </div>
          </Panel>

          <Panel
            title="Warming stations"
            actions={
              !locked && (
                <Button size="sm" variant="outline" onClick={() => set({ stations: [...draft.stations, { id: `st${Date.now()}`, offset: -60, channel: "WhatsApp", template: "New station", language: "Customer language" }] })}>
                  <Plus /> Add station
                </Button>
              )
            }
            bodyClassName="p-0"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Offset (days)</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Language</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {draft.stations.map((st, i) => {
                  const bad = st.offset < -draft.warmingStart || st.offset > 0;
                  return (
                    <tr
                      key={st.id}
                      draggable={!locked}
                      onDragStart={() => setDragId(st.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragId || dragId === st.id) return;
                        const list = draft.stations.filter((x) => x.id !== dragId);
                        const moved = draft.stations.find((x) => x.id === dragId)!;
                        list.splice(list.findIndex((x) => x.id === st.id), 0, moved);
                        set({ stations: list });
                        setDragId(null);
                      }}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">{!locked && <GripVertical className="size-4 cursor-grab" aria-label="Drag to reorder" />}</td>
                      <td className="px-3 py-1.5 tabular">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <input type="number" disabled={locked} value={st.offset} onChange={(e) => setStation(st.id, { offset: Math.round(Number(e.target.value) || 0) })} className={`${inputCls} w-24 tabular ${bad ? "border-failed" : ""}`} aria-label={`Station ${i + 1} offset`} />
                      </td>
                      <td className="px-3 py-1.5">
                        <select disabled={locked} value={st.channel} onChange={(e) => setStation(st.id, { channel: e.target.value as Station["channel"] })} className={selectCls} aria-label={`Station ${i + 1} channel`}>
                          {["WhatsApp", "Voice", "SMS"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input disabled={locked} value={st.template} onChange={(e) => setStation(st.id, { template: e.target.value })} className={inputCls} aria-label={`Station ${i + 1} template`} />
                      </td>
                      <td className="px-3 py-1.5">
                        <select disabled={locked} value={st.language} onChange={(e) => setStation(st.id, { language: e.target.value })} className={selectCls} aria-label={`Station ${i + 1} language`}>
                          {["Customer language", "English", "Hindi"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {!locked && (
                          <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove station ${i + 1}`} onClick={() => set({ stations: draft.stations.filter((x) => x.id !== st.id) })}>
                            <Trash2 />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Stages active per product" bodyClassName="p-0">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Stage</th>
                    {PRODUCTS.map((p) => (
                      <th key={p} className="px-3 py-2 font-medium">
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAGE_LIST.map((st) => (
                    <tr key={st} className="border-t border-border/60">
                      <td className="px-3 py-1.5">{st}</td>
                      {PRODUCTS.map((p: Product) => (
                        <td key={p} className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            disabled={locked}
                            aria-label={`${st} active for ${p}`}
                            checked={draft.activeByProduct[p].includes(st)}
                            onChange={(e) => set({ activeByProduct: { ...draft.activeByProduct, [p]: e.target.checked ? [...draft.activeByProduct[p], st] : draft.activeByProduct[p].filter((x) => x !== st) } })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Interrupts and where the case goes next" bodyClassName="p-0">
              <table className="w-full text-[13px]">
                <tbody>
                  {draft.interrupts.map((it, i) => (
                    <tr key={it.event} className="border-t border-border/60 first:border-t-0">
                      <td className="px-3 py-1.5">{it.event}</td>
                      <td className="px-3 py-1.5">
                        <select disabled={locked} value={it.next} aria-label={`${it.event} goes to`} onChange={(e) => set({ interrupts: draft.interrupts.map((x, j) => (j === i ? { ...x, next: e.target.value } : x)) })} className={selectCls}>
                          {INTERRUPT_NEXT.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Revival window by product">
            <div className="grid gap-3 sm:grid-cols-3">
              {PRODUCTS.map((p) => (
                <label key={p} className="block text-[12px] font-medium text-muted-foreground">
                  {p} (3 to 5 years)
                  <select disabled={locked} value={draft.revivalYears[p]} onChange={(e) => set({ revivalYears: { ...draft.revivalYears, [p]: Number(e.target.value) } })} className={`${selectCls} mt-1 w-full`}>
                    {[3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        {y} years
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Policies affected">
            <p className="text-[24px] font-semibold text-foreground tabular">{num(affected.n)}</p>
            <p className="text-[12px] text-muted-foreground">policies change stage against version {active.no}</p>
            <ul className="mt-3 space-y-1 text-[13px]">
              {Object.entries(affected.byStage).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-subtle">Move into {k}</span>
                  <span className="tabular">{num(v)}</span>
                </li>
              ))}
            </ul>
            {affected.n > SECOND_APPROVER_LIMIT && <NoteBanner tone="attention" className="mt-3">More than 5,000 policies move. A second approver is needed.</NoteBanner>}
          </Panel>
          {problems.length > 0 && (
            <NoteBanner tone="failed">
              <ul className="list-disc space-y-1 pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </NoteBanner>
          )}
        </div>
      </div>

      {mayEdit && (
        <EditFooter
          dirty={dirty}
          onSave={save}
          onDiscard={() => setDraft(base)}
          onSubmit={submit}
          submitDisabled={!!inReview || problems.length > 0 || (!dirty && !savedDraft)}
          status={problems.length ? `${problems.length} problem${problems.length > 1 ? "s" : ""} to fix` : undefined}
        />
      )}
    </div>
  );
}
