export interface LmsRow {
  /** Age in completed months (0-24). */
  ageMonths: number
  /** Box-Cox power. */
  L: number
  /** Median, in our internal units (grams for weight, millimetres for height/head circumference). */
  M: number
  /** Generalized coefficient of variation. */
  S: number
}

/**
 * WHO Child Growth Standards (0-24 months), monthly LMS parameters converted to
 * this app's internal units (grams, millimetres); the percentile curves are derived
 * from them (`referenceCurves`). Source: WHO Child Growth Standards, mirrored by
 * the CDC as plain CSV —
 * https://www.who.int/tools/child-growth-standards/standards
 * https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/ (WHO-*-Percentiles.csv)
 */
const weightBoys: LmsRow[] = [
  { ageMonths: 0, L: 0.3487, M: 3346.4, S: 0.14602 },
  { ageMonths: 1, L: 0.2297, M: 4470.9, S: 0.13395 },
  { ageMonths: 2, L: 0.197, M: 5567.5, S: 0.12385 },
  { ageMonths: 3, L: 0.1738, M: 6376.2, S: 0.11727 },
  { ageMonths: 4, L: 0.1553, M: 7002.3, S: 0.11316 },
  { ageMonths: 5, L: 0.1395, M: 7510.5, S: 0.1108 },
  { ageMonths: 6, L: 0.1257, M: 7934, S: 0.10958 },
  { ageMonths: 7, L: 0.1134, M: 8297, S: 0.10902 },
  { ageMonths: 8, L: 0.1021, M: 8615.1, S: 0.10882 },
  { ageMonths: 9, L: 0.0917, M: 8901.4, S: 0.10881 },
  { ageMonths: 10, L: 0.082, M: 9164.9, S: 0.10891 },
  { ageMonths: 11, L: 0.073, M: 9412.2, S: 0.10906 },
  { ageMonths: 12, L: 0.0644, M: 9647.9, S: 0.10925 },
  { ageMonths: 13, L: 0.0563, M: 9874.9, S: 0.10949 },
  { ageMonths: 14, L: 0.0487, M: 10095.3, S: 0.10976 },
  { ageMonths: 15, L: 0.0413, M: 10310.8, S: 0.11007 },
  { ageMonths: 16, L: 0.0343, M: 10522.8, S: 0.11041 },
  { ageMonths: 17, L: 0.0275, M: 10731.9, S: 0.11079 },
  { ageMonths: 18, L: 0.0211, M: 10938.5, S: 0.11119 },
  { ageMonths: 19, L: 0.0148, M: 11143, S: 0.11164 },
  { ageMonths: 20, L: 0.0087, M: 11346.2, S: 0.11211 },
  { ageMonths: 21, L: 0.0029, M: 11548.6, S: 0.11261 },
  { ageMonths: 22, L: -0.0028, M: 11750.4, S: 0.11314 },
  { ageMonths: 23, L: -0.0083, M: 11951.4, S: 0.11369 },
  { ageMonths: 24, L: -0.0137, M: 12151.5, S: 0.11426 },
]

const weightGirls: LmsRow[] = [
  { ageMonths: 0, L: 0.3809, M: 3232.2, S: 0.14171 },
  { ageMonths: 1, L: 0.1714, M: 4187.3, S: 0.13724 },
  { ageMonths: 2, L: 0.0962, M: 5128.2, S: 0.13 },
  { ageMonths: 3, L: 0.0402, M: 5845.8, S: 0.12619 },
  { ageMonths: 4, L: -0.005, M: 6423.7, S: 0.12402 },
  { ageMonths: 5, L: -0.043, M: 6898.5, S: 0.12274 },
  { ageMonths: 6, L: -0.0756, M: 7297, S: 0.12204 },
  { ageMonths: 7, L: -0.1039, M: 7642.2, S: 0.12178 },
  { ageMonths: 8, L: -0.1288, M: 7948.7, S: 0.12181 },
  { ageMonths: 9, L: -0.1507, M: 8225.4, S: 0.12199 },
  { ageMonths: 10, L: -0.17, M: 8480, S: 0.12223 },
  { ageMonths: 11, L: -0.1872, M: 8719.2, S: 0.12247 },
  { ageMonths: 12, L: -0.2024, M: 8948.1, S: 0.12268 },
  { ageMonths: 13, L: -0.2158, M: 9169.9, S: 0.12283 },
  { ageMonths: 14, L: -0.2278, M: 9387, S: 0.12294 },
  { ageMonths: 15, L: -0.2384, M: 9600.8, S: 0.12299 },
  { ageMonths: 16, L: -0.2478, M: 9812.4, S: 0.12303 },
  { ageMonths: 17, L: -0.2562, M: 10022.6, S: 0.12306 },
  { ageMonths: 18, L: -0.2637, M: 10231.5, S: 0.12309 },
  { ageMonths: 19, L: -0.2703, M: 10439.3, S: 0.12315 },
  { ageMonths: 20, L: -0.2762, M: 10646.4, S: 0.12323 },
  { ageMonths: 21, L: -0.2815, M: 10853.4, S: 0.12335 },
  { ageMonths: 22, L: -0.2862, M: 11060.8, S: 0.1235 },
  { ageMonths: 23, L: -0.2903, M: 11268.8, S: 0.12369 },
  { ageMonths: 24, L: -0.2941, M: 11477.5, S: 0.1239 },
]

const heightBoys: LmsRow[] = [
  { ageMonths: 0, L: 1, M: 498.84, S: 0.03795 },
  { ageMonths: 1, L: 1, M: 547.24, S: 0.03557 },
  { ageMonths: 2, L: 1, M: 584.25, S: 0.03424 },
  { ageMonths: 3, L: 1, M: 614.29, S: 0.03328 },
  { ageMonths: 4, L: 1, M: 638.86, S: 0.03257 },
  { ageMonths: 5, L: 1, M: 659.03, S: 0.03204 },
  { ageMonths: 6, L: 1, M: 676.24, S: 0.03165 },
  { ageMonths: 7, L: 1, M: 691.65, S: 0.03139 },
  { ageMonths: 8, L: 1, M: 705.99, S: 0.03124 },
  { ageMonths: 9, L: 1, M: 719.69, S: 0.03117 },
  { ageMonths: 10, L: 1, M: 732.81, S: 0.03118 },
  { ageMonths: 11, L: 1, M: 745.39, S: 0.03125 },
  { ageMonths: 12, L: 1, M: 757.49, S: 0.03137 },
  { ageMonths: 13, L: 1, M: 769.19, S: 0.03154 },
  { ageMonths: 14, L: 1, M: 780.5, S: 0.03174 },
  { ageMonths: 15, L: 1, M: 791.46, S: 0.03197 },
  { ageMonths: 16, L: 1, M: 802.11, S: 0.03222 },
  { ageMonths: 17, L: 1, M: 812.49, S: 0.0325 },
  { ageMonths: 18, L: 1, M: 822.59, S: 0.03279 },
  { ageMonths: 19, L: 1, M: 832.42, S: 0.0331 },
  { ageMonths: 20, L: 1, M: 842, S: 0.03342 },
  { ageMonths: 21, L: 1, M: 851.35, S: 0.03376 },
  { ageMonths: 22, L: 1, M: 860.48, S: 0.0341 },
  { ageMonths: 23, L: 1, M: 869.41, S: 0.03445 },
  { ageMonths: 24, L: 1, M: 878.16, S: 0.03479 },
]

const heightGirls: LmsRow[] = [
  { ageMonths: 0, L: 1, M: 491.48, S: 0.0379 },
  { ageMonths: 1, L: 1, M: 536.87, S: 0.0364 },
  { ageMonths: 2, L: 1, M: 570.67, S: 0.03568 },
  { ageMonths: 3, L: 1, M: 598.03, S: 0.0352 },
  { ageMonths: 4, L: 1, M: 620.9, S: 0.03486 },
  { ageMonths: 5, L: 1, M: 640.3, S: 0.03463 },
  { ageMonths: 6, L: 1, M: 657.31, S: 0.03448 },
  { ageMonths: 7, L: 1, M: 672.87, S: 0.03441 },
  { ageMonths: 8, L: 1, M: 687.5, S: 0.0344 },
  { ageMonths: 9, L: 1, M: 701.44, S: 0.03444 },
  { ageMonths: 10, L: 1, M: 714.82, S: 0.03452 },
  { ageMonths: 11, L: 1, M: 727.71, S: 0.03464 },
  { ageMonths: 12, L: 1, M: 740.15, S: 0.03479 },
  { ageMonths: 13, L: 1, M: 752.18, S: 0.03496 },
  { ageMonths: 14, L: 1, M: 763.82, S: 0.03514 },
  { ageMonths: 15, L: 1, M: 775.1, S: 0.03534 },
  { ageMonths: 16, L: 1, M: 786.06, S: 0.03555 },
  { ageMonths: 17, L: 1, M: 796.71, S: 0.03576 },
  { ageMonths: 18, L: 1, M: 807.08, S: 0.03598 },
  { ageMonths: 19, L: 1, M: 817.18, S: 0.0362 },
  { ageMonths: 20, L: 1, M: 827.04, S: 0.03643 },
  { ageMonths: 21, L: 1, M: 836.65, S: 0.03666 },
  { ageMonths: 22, L: 1, M: 846.04, S: 0.03688 },
  { ageMonths: 23, L: 1, M: 855.2, S: 0.03711 },
  { ageMonths: 24, L: 1, M: 864.15, S: 0.03734 },
]

const headBoys: LmsRow[] = [
  { ageMonths: 0, L: 1, M: 344.62, S: 0.03686 },
  { ageMonths: 1, L: 1, M: 372.76, S: 0.03133 },
  { ageMonths: 2, L: 1, M: 391.29, S: 0.02997 },
  { ageMonths: 3, L: 1, M: 405.14, S: 0.02918 },
  { ageMonths: 4, L: 1, M: 416.32, S: 0.02868 },
  { ageMonths: 5, L: 1, M: 425.58, S: 0.02837 },
  { ageMonths: 6, L: 1, M: 433.31, S: 0.02817 },
  { ageMonths: 7, L: 1, M: 439.8, S: 0.02804 },
  { ageMonths: 8, L: 1, M: 445.3, S: 0.02796 },
  { ageMonths: 9, L: 1, M: 450, S: 0.02792 },
  { ageMonths: 10, L: 1, M: 454.05, S: 0.0279 },
  { ageMonths: 11, L: 1, M: 457.57, S: 0.02789 },
  { ageMonths: 12, L: 1, M: 460.66, S: 0.02789 },
  { ageMonths: 13, L: 1, M: 463.4, S: 0.02789 },
  { ageMonths: 14, L: 1, M: 465.84, S: 0.02791 },
  { ageMonths: 15, L: 1, M: 468.06, S: 0.02792 },
  { ageMonths: 16, L: 1, M: 470.09, S: 0.02795 },
  { ageMonths: 17, L: 1, M: 471.96, S: 0.02797 },
  { ageMonths: 18, L: 1, M: 473.71, S: 0.028 },
  { ageMonths: 19, L: 1, M: 475.36, S: 0.02803 },
  { ageMonths: 20, L: 1, M: 476.92, S: 0.02806 },
  { ageMonths: 21, L: 1, M: 478.41, S: 0.0281 },
  { ageMonths: 22, L: 1, M: 479.83, S: 0.02813 },
  { ageMonths: 23, L: 1, M: 481.2, S: 0.02817 },
  { ageMonths: 24, L: 1, M: 482.52, S: 0.02821 },
]

const headGirls: LmsRow[] = [
  { ageMonths: 0, L: 1, M: 338.79, S: 0.03496 },
  { ageMonths: 1, L: 1, M: 365.46, S: 0.0321 },
  { ageMonths: 2, L: 1, M: 382.52, S: 0.03168 },
  { ageMonths: 3, L: 1, M: 395.33, S: 0.0314 },
  { ageMonths: 4, L: 1, M: 405.82, S: 0.03119 },
  { ageMonths: 5, L: 1, M: 414.59, S: 0.03102 },
  { ageMonths: 6, L: 1, M: 422, S: 0.03087 },
  { ageMonths: 7, L: 1, M: 428.29, S: 0.03075 },
  { ageMonths: 8, L: 1, M: 433.67, S: 0.03063 },
  { ageMonths: 9, L: 1, M: 438.3, S: 0.03053 },
  { ageMonths: 10, L: 1, M: 442.32, S: 0.03044 },
  { ageMonths: 11, L: 1, M: 445.84, S: 0.03035 },
  { ageMonths: 12, L: 1, M: 448.97, S: 0.03027 },
  { ageMonths: 13, L: 1, M: 451.75, S: 0.03019 },
  { ageMonths: 14, L: 1, M: 454.27, S: 0.03012 },
  { ageMonths: 15, L: 1, M: 456.55, S: 0.03006 },
  { ageMonths: 16, L: 1, M: 458.65, S: 0.02999 },
  { ageMonths: 17, L: 1, M: 460.6, S: 0.02993 },
  { ageMonths: 18, L: 1, M: 462.42, S: 0.02987 },
  { ageMonths: 19, L: 1, M: 464.15, S: 0.02982 },
  { ageMonths: 20, L: 1, M: 465.8, S: 0.02977 },
  { ageMonths: 21, L: 1, M: 467.38, S: 0.02972 },
  { ageMonths: 22, L: 1, M: 468.91, S: 0.02967 },
  { ageMonths: 23, L: 1, M: 470.39, S: 0.02962 },
  { ageMonths: 24, L: 1, M: 471.82, S: 0.02957 },
]


export type Sex = 'female' | 'male'

export const WHO_GROWTH_TABLES: Record<'weight' | 'height' | 'headCircumference', Record<Sex, LmsRow[]>> = {
  weight: { male: weightBoys, female: weightGirls },
  height: { male: heightBoys, female: heightGirls },
  headCircumference: { male: headBoys, female: headGirls },
}
