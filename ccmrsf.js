/* CCM-RSF prediction engine.
 * Reproduces randomForestSRC predict() for the frozen 53-feature model exported by
 * "analysis/R/export_web_model, 20261012.R". Works in the browser and in Node.js.
 *   risk score  = mean over trees of the terminal-node mortality
 *   survival(t) = mean over trees of the terminal-node survival on a quarterly 0-10 y grid
 * A case goes to the left child when x <= split value.
 */
(function (root) {
  "use strict";

  function decode(b64) {
    if (typeof atob === "function") {
      const s = atob(b64), u = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return u.buffer;
    }
    const b = Buffer.from(b64, "base64");
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }

  function load(m) {
    return {
      meta: m,
      var: new Uint8Array(decode(m.var)),
      split: new Float64Array(decode(m.split)),
      right: new Int32Array(decode(m.right)),
      leaf: new Int32Array(decode(m.leaf)),
      start: new Int32Array(decode(m.start)),
      mort: new Float64Array(decode(m.mort)),
      surv: new Uint16Array(decode(m.surv)),
      ng: m.grid.length
    };
  }

  /* x: array of 53 numbers in model feature order (m.features). */
  function predict(model, x) {
    const nt = model.meta.ntree, ng = model.ng;
    let mort = 0;
    const surv = new Float64Array(ng);
    for (let b = 0; b < nt; b++) {
      let i = model.start[b];
      while (model.var[i] > 0) {
        i = x[model.var[i] - 1] <= model.split[i] ? i + 1 : model.right[i];
      }
      const k = model.leaf[i];
      mort += model.mort[k];
      const off = k * ng;
      for (let j = 0; j < ng; j++) surv[j] += model.surv[off + j];
    }
    mort /= nt;
    for (let j = 0; j < ng; j++) surv[j] = surv[j] / 65535 / nt;
    const c = model.meta.cutoffs;
    const group = mort >= c[1] ? "adverse" : mort < c[0] ? "favorable" : "intermediate";
    return { score: mort, group: group, grid: model.meta.grid, surv: Array.from(surv) };
  }

  /* Survival at time t (years) from the grid, and median OS by linear interpolation. */
  function survAt(res, t) {
    const g = res.grid;
    for (let j = g.length - 1; j >= 0; j--) if (g[j] <= t) return res.surv[j];
    return 1;
  }
  function median(res) {
    const g = res.grid, s = res.surv;
    for (let j = 1; j < s.length; j++) {
      if (s[j] <= 0.5) return g[j - 1] + (s[j - 1] - 0.5) / (s[j - 1] - s[j]) * (g[j] - g[j - 1]);
    }
    return null;                      // not reached within the grid
  }

  /* ELN-2022 genetic risk derived from the entered variables, using the same rules as the study:
   * favorable: t(8;21), inv(16)/t(16;16); NPM1 without FLT3-ITD; CEBPA bZIP
   * adverse: t(6;9), t(9;22), t(8;16), inv(3)/t(3;3), -5/del(5q), -7, -17, complex karyotype,
   *          other ELN adverse abnormality, TP53; MDS-related gene mutation
   * intermediate: t(9;11); NPM1 with FLT3-ITD; FLT3-ITD; otherwise */
  function eln2022(v) {
    const y = (k) => v[k] === 1;
    if (y("t(8;21)") || y("inv(16)") || y("t(16;16)")) return "favorable";
    const advC = ["t(6;9)", "t(9;22)", "t(8;16)", "inv(3)", "t(3;3)", "-5", "del(5q)", "-7", "-17",
                  "Cplx", "TP53", "other_adverse"].some(y);
    if (advC) return "adverse";
    if (y("t(9;11)")) return "intermediate";
    if (y("NPM1")) return y("FLT3_ITD") ? "intermediate" : "favorable";
    if (y("CEBPA_bZIP")) return "favorable";
    if (y("FLT3_ITD")) return "intermediate";
    const mds = ["ASXL1", "BCOR", "EZH2", "RUNX1", "SF3B1", "SRSF2", "STAG2", "U2AF1", "ZRSR2"];
    return mds.some(y) ? "adverse" : "intermediate";
  }

  const api = { load: load, predict: predict, survAt: survAt, median: median, eln2022: eln2022 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CCMRSF = api;
})(typeof window !== "undefined" ? window : globalThis);
