import { ADRENALINE } from '../config/combat';

/**
 * The single Adrenaline meter. Capacity comes from Willpower; move costs are fixed.
 * Pure logic so it can be unit-tested and driven by the Phaser scene.
 */
export class AdrenalineMeter {
  value: number;
  readonly max: number;
  private lastHitGrant = -Infinity;
  private hitGranted = new Set<string>();
  private dodgeGranted = new Set<string>();

  constructor(max: number, start?: number) {
    this.max = max;
    this.value = start ?? Math.floor(max * ADRENALINE.startFraction);
    this.clamp();
  }
  private clamp() { this.value = Math.max(0, Math.min(this.max, this.value)); }

  /** Passive gain only during active combat. */
  tick(dt: number, active: boolean) {
    if (!active || dt <= 0) return;
    this.value += ADRENALINE.passivePerSecond * Math.min(dt, 0.25);
    this.clamp();
  }
  /** Successful basic hit. One grant per attack, at most one per 0.4s, none on an invulnerable target. */
  onBasicHit(attackId: string, time: number, targetVulnerable: boolean, active = true): number {
    if (!active || !targetVulnerable || this.hitGranted.has(attackId)) return 0;
    if (time - this.lastHitGrant < ADRENALINE.hitRewardMinInterval) return 0;
    this.hitGranted.add(attackId);
    this.lastHitGrant = time;
    const before = this.value;
    this.value += ADRENALINE.basicHit;
    this.clamp();
    return this.value - before;
  }
  /** A dodge that actually avoided a specific incoming attack. Once per avoided attack. */
  onPerfectDodge(incomingAttackId: string, active = true): number {
    if (!active || this.dodgeGranted.has(incomingAttackId)) return 0;
    this.dodgeGranted.add(incomingAttackId);
    const before = this.value;
    this.value += ADRENALINE.perfectDodge;
    this.clamp();
    return this.value - before;
  }
  canSpend(cost: number): boolean { return cost <= this.value && cost <= this.max; }
  spend(cost: number): boolean {
    if (!this.canSpend(cost)) return false;
    this.value -= cost;
    this.clamp();
    return true;
  }
  /** Restore a saved value when resuming (never a refill). */
  restore(v: number) { this.value = v; this.clamp(); }
}
