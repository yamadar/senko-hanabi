// チューニング定数 / Tuning constants

// 火種・火花の同時存在数の上限
export const MAX_SPARKLERS = 12;
export const MAX_SPARKS = 2000;

// 実質的な上限を時間でゆらがせるサイクル長 (秒)
// サイクル: 100%キープ → ゆっくり30%へ下降 → 素早く100%へ戻る
export const CYCLE_SECONDS = 90;

// ===== スプライトキャッシュ寸法 =====
export const HUE_STEPS = 18; // 20°刻み
export const SPARK_SIZE = 64; // 火花用スプライト
export const HALO_SIZE = 128; // 火種ハロー用
export const MID_SIZE = 64; // 火種中間層用
export const CORE_SIZE = 32; // 火種コア用 (白なので色相不要)
