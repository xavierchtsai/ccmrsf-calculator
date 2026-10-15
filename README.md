# CCM-RSF risk calculator for AML

A browser-based calculator for the **Clinical-Cytogenetic-Molecular Random Survival Forest (CCM-RSF)**, a survival model for adults with de novo, non-APL acute myeloid leukemia treated with intensive induction.

**Use the calculator:** https://xavierchtsai.github.io/ccmrsf-calculator/

## Model

- Random survival forest with 400 trees and 53 variables available at diagnosis: age, sex, WBC count, hemoglobin, platelet count, bone marrow blast percentage, 13 ELN-defined cytogenetic abnormalities, complex karyotype, 31 gene mutations (including *KMT2A*-PTD), *FLT3*-ITD and *CEBPA* bZIP in-frame mutation.
- Trained on 801 patients from National Taiwan University Hospital and validated without refitting in the UK-NCRI, AMLSG and Beat AML cohorts.
- Risk groups use cutoffs locked at the tertiles of the development cohort (risk score 52.86 and 97.52).

## How it works

The page runs entirely in the browser; no data leave the user's computer. `ccmrsf.js` passes the entered values through the 400 trees stored in `model.js` and reproduces the R `randomForestSRC` predictions:

- risk score: mean terminal-node mortality across trees
- predicted overall survival: mean terminal-node survival, on a quarterly grid from 0 to 10 years

Abnormalities marked *Unknown* are treated as absent, as in model development. The ELN-2022 group shown alongside is derived from the entered variables.

## Reference

A manuscript describing the development and validation of the CCM-RSF model is in preparation, and the citation will be added here upon publication. Until then, please cite this repository: https://github.com/xavierchtsai/ccmrsf-calculator

## Disclaimer

This calculator is provided for research and educational purposes only. It is not a medical device, has not been approved by any regulatory authority, and must not be used as the sole basis for diagnosis or treatment decisions. Predictions are population-level estimates derived from the cohorts described above and may not apply to patients who differ from them, including patients with APL, secondary or therapy-related AML, or those not treated with intensive induction. Clinical decisions should be made by qualified physicians who consider the full clinical context.

All calculations run locally in the browser; no patient data are transmitted or stored.

## Contact

Questions and comments: Xavier Cheng-Hong Tsai, Division of Hematology, Department of Internal Medicine, National Taiwan University Hospital, Taipei, Taiwan (xavierchtsai@ntu.edu.tw).

## License

The source code of this calculator is released under the [MIT License](LICENSE). The license covers the code only; it does not grant any right to use the model outputs for clinical care, and use of the model in publications should be acknowledged as described under Reference.
