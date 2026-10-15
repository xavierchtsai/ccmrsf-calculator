/* CCM-RSF web calculator: form, prediction and display. */
(function () {
  "use strict";
  const M = CCMRSF.load(window.CCMRSF_MODEL);
  const FEATS = M.meta.features;

  /* ---- binary inputs: [model key, label (HTML), section] ---- */
  const CYTO = [
    ["t(8;21)", "t(8;21)"], ["inv(16)", "inv(16)"], ["t(16;16)", "t(16;16)"], ["t(9;11)", "t(9;11)"],
    ["t(6;9)", "t(6;9)"], ["t(9;22)", "t(9;22)"], ["t(8;16)", "t(8;16)"], ["inv(3)", "inv(3)"],
    ["t(3;3)", "t(3;3)"], ["-5", "&minus;5"], ["del(5q)", "del(5q)"], ["-7", "&minus;7"], ["-17", "&minus;17"],
    ["Cplx", "Complex karyotype (&ge;3 abnormalities)"]
  ];
  const OTHER = ["other_adverse", "Other ELN-2022 adverse abnormality <span class='note'>(" +
    "<i class='g'>KMT2A</i> or <i class='g'>MECOM</i> rearrangement, abn(17p), monosomal karyotype; affects ELN-2022 only)</span>"];
  const g = (s) => "<i class='g'>" + s + "</i>";
  const MUT = [
    ["ELN-2022 defining", [["NPM1", g("NPM1")], ["FLT3_ITD", g("FLT3") + "-ITD"], ["FLT_TKD", g("FLT3") + "-TKD"],
      ["CEBPA_bZIP", g("CEBPA") + " bZIP in-frame"], ["TP53", g("TP53")], ["MLL", g("KMT2A") + "-PTD"]]],
    ["Myelodysplasia-related", [["ASXL1", g("ASXL1")], ["BCOR", g("BCOR")], ["EZH2", g("EZH2")], ["RUNX1", g("RUNX1")],
      ["SF3B1", g("SF3B1")], ["SRSF2", g("SRSF2")], ["STAG2", g("STAG2")], ["U2AF1", g("U2AF1")], ["ZRSR2", g("ZRSR2")]]],
    ["Signaling", [["KIT", g("KIT")], ["NRAS", g("NRAS")], ["KRAS", g("KRAS")], ["PTPN11", g("PTPN11")],
      ["c-CBL", g("CBL")], ["CBL-b", g("CBLB")]]],
    ["DNA methylation", [["IDH1", g("IDH1")], ["IDH2", g("IDH2")], ["TET2", g("TET2")], ["DNMT3A", g("DNMT3A")]]],
    ["Cohesin", [["Rad21", g("RAD21")], ["SMC1A", g("SMC1A")], ["SMC3", g("SMC3")], ["STAG1", g("STAG1")]]],
    ["Other", [["WT1", g("WT1")], ["PHF6", g("PHF6")], ["ETV6", g("ETV6")], ["GATA2", g("GATA2")]]]
  ];

  const state = {};
  function toggle(key, label) {
    state[key] = "0";
    const row = document.createElement("div"); row.className = "yn";
    row.innerHTML = "<span class='lab'>" + label + "</span><span class='seg'>" +
      ["1:Yes", "0:No", "u:Unknown"].map((p) => { const [v, t] = p.split(":");
        return "<button type='button' data-k='" + key + "' data-v='" + v + "'" + (v === "0" ? " class='on'" : "") + ">" + t + "</button>"; }).join("") +
      "</span>";
    return row;
  }
  function build() {
    const cy = document.getElementById("cyto"); const grid = document.createElement("div"); grid.className = "grid2";
    CYTO.forEach(([k, l]) => grid.appendChild(toggle(k, l))); cy.appendChild(grid);
    const other = toggle(OTHER[0], OTHER[1]); other.style.marginTop = "8px"; cy.appendChild(other);
    const mu = document.getElementById("mut");
    MUT.forEach(([title, items]) => {
      const h = document.createElement("h3"); h.textContent = title; mu.appendChild(h);
      const gr = document.createElement("div"); gr.className = "grid2";
      items.forEach(([k, l]) => gr.appendChild(toggle(k, l))); mu.appendChild(gr);
    });
    const listed = new Set(CYTO.map((x) => x[0]).concat(...MUT.map((x) => x[1].map((y) => y[0]))));
    const missing = FEATS.filter((f) => !["Age", "Gender", "WBC", "Hb", "Plt", "BM_Blast"].includes(f) && !listed.has(f));
    if (missing.length) console.error("Model features without an input:", missing);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".seg button"); if (!b) return;
    state[b.dataset.k] = b.dataset.v;
    b.parentNode.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });

  /* ---- read inputs ---- */
  const NUM = { Age: [15, 100, "Age"], WBC: [0, 1000, "WBC"], Hb: [1, 25, "Hemoglobin"], Plt: [0, 2000, "Platelets"], BM_Blast: [0, 100, "Bone marrow blasts"] };
  function read() {
    const v = {}, errs = [];
    for (const [k, [lo, hi, name]] of Object.entries(NUM)) {
      const raw = document.getElementById(k).value.trim(); const x = Number(raw);
      if (raw === "" || !isFinite(x)) errs.push(name + " is required");
      else if (x < lo || x > hi) errs.push(name + " must be between " + lo + " and " + hi);
      v[k] = x;
    }
    const sex = document.getElementById("Gender").value;
    if (sex === "") errs.push("Sex is required"); v.Gender = Number(sex);
    v.WBC = v.WBC * 1000;                                   // model unit: /µL
    for (const k in state) v[k] = state[k] === "1" ? 1 : 0; // Unknown -> absent
    const unknown = Object.keys(state).filter((k) => state[k] === "u").length;
    return { v, errs, unknown };
  }

  /* ---- display ---- */
  const COL = { adverse: "#c0392b", intermediate: "#d68910", favorable: "#1e8449" };
  const pct = (x) => (100 * x).toFixed(1) + "%";
  function scorePos(s) {                                    // piecewise scale so the cutoffs sit at 1/3 and 2/3
    const [c0, c1] = M.meta.cutoffs, lo = 0, hi = 2 * c1;
    let p = s < c0 ? (s - lo) / (c0 - lo) / 3 : s < c1 ? 1 / 3 + (s - c0) / (c1 - c0) / 3 : 2 / 3 + (s - c1) / (hi - c1) / 3;
    return Math.max(0, Math.min(1, p)) * 100;
  }
  function chart(res) {
    const W = 520, H = 300, L = 44, R = 12, T = 12, B = 38, x = (t) => L + t / 10 * (W - L - R), y = (s) => T + (1 - s) * (H - T - B);
    const path = (arr) => arr.map((s, j) => (j ? "L" : "M") + x(res.grid[j]).toFixed(1) + " " + y(s).toFixed(1)).join(" ");
    const step = (arr) => arr.map((s, j) => j ? "H" + x(res.grid[j]).toFixed(1) + " V" + y(s).toFixed(1) : "M" + x(0) + " " + y(s).toFixed(1)).join(" ");
    let svg = "<svg viewBox='0 0 " + W + " " + H + "' width='100%' role='img' aria-label='Predicted overall survival'>";
    for (let s = 0; s <= 1.0001; s += 0.25) svg += "<line x1='" + L + "' x2='" + (W - R) + "' y1='" + y(s) + "' y2='" + y(s) + "' stroke='#eceff3'/><text x='" + (L - 6) + "' y='" + (y(s) + 4) + "' text-anchor='end'>" + s.toFixed(2) + "</text>";
    for (let t = 0; t <= 10; t += 2) svg += "<text x='" + x(t) + "' y='" + (H - B + 16) + "' text-anchor='middle'>" + t + "</text>";
    svg += "<text x='" + ((L + W - R) / 2) + "' y='" + (H - 6) + "' text-anchor='middle'>Years from diagnosis</text>";
    for (const k of ["favorable", "intermediate", "adverse"])
      svg += "<path d='" + step(M.meta.ref[k]) + "' fill='none' stroke='" + COL[k] + "' stroke-width='1.5' stroke-dasharray='5 3' opacity='.75'/>";
    svg += "<path d='" + path(res.surv) + "' fill='none' stroke='#1d2433' stroke-width='3'/>";
    return svg + "</svg><div class='legend'><span style='--c:#1d2433'>This patient (CCM-RSF)</span>" +
      ["favorable", "intermediate", "adverse"].map((k) => "<span class='dash' style='--c:" + COL[k] + "'>NTUH " + k + "</span>").join("") + "</div>";
  }
  function render(res, eln, unknown) {
    const med = CCMRSF.median(res);
    const [c0, c1] = M.meta.cutoffs;
    document.getElementById("result").innerHTML =
      "<h2>Result</h2><div class='badges'>" +
      "<div class='badge bg-" + res.group + "'><div class='k'>CCM-RSF risk group</div><div class='v'>" + res.group + "</div></div>" +
      "<div class='badge bg-" + eln + "'><div class='k'>ELN-2022 (derived)</div><div class='v'>" + eln + "</div></div></div>" +
      "<div class='score'>Risk score <b>" + res.score.toFixed(2) + "</b></div>" +
      "<div class='bar'><div class='pin' style='left:" + scorePos(res.score) + "%'></div>" +
      "<span class='tick' style='left:33.3%'>" + c0.toFixed(2) + "</span><span class='tick' style='left:66.6%'>" + c1.toFixed(2) + "</span></div>" +
      "<table class='os'><tr><th>Predicted overall survival</th><td class='n'></td></tr>" +
      "<tr><td>1 year</td><td class='n'>" + pct(CCMRSF.survAt(res, 1)) + "</td></tr>" +
      "<tr><td>2 years</td><td class='n'>" + pct(CCMRSF.survAt(res, 2)) + "</td></tr>" +
      "<tr><td>5 years</td><td class='n'>" + pct(CCMRSF.survAt(res, 5)) + "</td></tr>" +
      "<tr><td>Median OS</td><td class='n'>" + (med === null ? "not reached (&gt;10 years)" : med.toFixed(1) + " years") + "</td></tr></table>" +
      chart(res) +
      (unknown ? "<p class='note'>" + unknown + " item(s) marked Unknown were treated as absent.</p>" : "");
  }

  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const { v, errs, unknown } = read();
    document.getElementById("err").textContent = errs.join("; ");
    if (errs.length) return;
    const x = FEATS.map((f) => v[f]);
    render(CCMRSF.predict(M, x), CCMRSF.eln2022(v), unknown);
  });
  document.getElementById("reset").addEventListener("click", () => {
    document.getElementById("form").reset();
    document.querySelectorAll(".seg button").forEach((b) => { b.classList.toggle("on", b.dataset.v === "0"); state[b.dataset.k] = "0"; });
    document.getElementById("err").textContent = "";
    document.getElementById("result").innerHTML = "<h2>Result</h2><p class='result-empty'>Enter the patient data and press <b>Calculate</b>.</p>";
  });

  build();
})();
