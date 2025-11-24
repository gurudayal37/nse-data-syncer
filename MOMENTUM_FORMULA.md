# Momentum Score Calculation Methodology

Based on your request and the provided image, here is the proposed formula.

## 1. Momentum Ratio (MR)
The Momentum Ratio adjusts the price return by the stock's volatility.

$$ MR_{period} = \frac{\text{Price Return}_{period}}{\sigma_p} $$

*   **Price Return:** We will use the **current** price return to make it relevant for a live dashboard (ignoring the "M-1" lag used in index rebalancing).
    *   $Return_{1m} = \frac{Price_t}{Price_{t-21}} - 1$
    *   $Return_{3m} = \frac{Price_t}{Price_{t-63}} - 1$
    *   $Return_{6m} = \frac{Price_t}{Price_{t-126}} - 1$
    *   $Return_{12m} = \frac{Price_t}{Price_{t-252}} - 1$
*   **Volatility ($\sigma_p$):** Annualized Standard Deviation of daily log returns over the last 1 year (252 days).
    *   $\sigma_p = StdDev(ln(\frac{P_t}{P_{t-1}})) \times \sqrt{252}$

## 2. Z-Score Calculation
We standardize the Momentum Ratio against the entire universe of stocks (all ~750 NSE stocks).

$$ Z_{period} = \frac{MR_{period} - \mu_{universe}}{\sigma_{universe}} $$

*   $\mu_{universe}$: Mean of $MR_{period}$ for all stocks.
*   $\sigma_{universe}$: Standard Deviation of $MR_{period}$ for all stocks.

## 3. Weighted Average Z-Score
Since we are adding 1M and 3M periods, we need to define weights. I propose **Equal Weights (25%)** unless you prefer otherwise.

$$ Z_{weighted} = 0.25(Z_{1m}) + 0.25(Z_{3m}) + 0.25(Z_{6m}) + 0.25(Z_{12m}) $$

## 4. Normalized Momentum Score
This converts the Z-Score into a positive score for easier reading.

*   **If $Z_{weighted} \ge 0$:**
    $$ Score = 1 + Z_{weighted} $$
*   **If $Z_{weighted} < 0$:**
    $$ Score = \frac{1}{1 - Z_{weighted}} $$

---

### Example
| Period | Return | Volatility | MR | Universe Mean | Universe StdDev | Z-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1M** | 5% | 20% | 0.25 | 0.10 | 0.5 | **0.30** |
| **3M** | 12% | 20% | 0.60 | 0.30 | 0.8 | **0.375** |
| **6M** | 25% | 20% | 1.25 | 0.50 | 1.0 | **0.75** |
| **12M** | 40% | 20% | 2.00 | 0.80 | 1.5 | **0.80** |

**Weighted Z-Score:** $(0.30 + 0.375 + 0.75 + 0.80) / 4 = \mathbf{0.556}$
**Final Score:** $1 + 0.556 = \mathbf{1.56}$
