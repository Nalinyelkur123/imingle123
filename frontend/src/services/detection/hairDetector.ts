// ============================================================================
// V Mingle — Modular Hair Detection Computer Vision Engine
// ============================================================================
// Analyzes sampled video frames to detect whether visible hair extends
// beyond the jawline towards the shoulder region.
//
// DESIGN PRINCIPLES:
// 1. Modular: Implements IHairDetector so models (MediaPipe, OpenCV, ML)
//    can be swapped without altering application or video architecture.
// 2. Non-blocking: Analyzes scaled down offscreen buffers to maintain 60 FPS
//    video chat performance.
// 3. Privacy-safe: Zero gender inference, zero face identity recognition.
// ============================================================================

export interface HairDetectionMetrics {
  scalpCoverage: number;
  jawlineExtension: number;
  shoulderLevelDensity: number;
  contrastRatio: number;
}

export interface DetectionResult {
  long_hair_detected: boolean;
  confidence: number;
  metrics?: HairDetectionMetrics;
}

export interface IHairDetector {
  detect(source: HTMLVideoElement): Promise<DetectionResult>;
  dispose?(): void;
}

/**
 * Computer-Vision Hair Detector
 * Uses skin-tone exclusion, hair spatial continuity, and shoulder-level
 * boundary estimation to determine visible hair length.
 */
export class VisionHairDetector implements IHairDetector {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly targetWidth = 160;
  private readonly targetHeight = 120;

  constructor() {
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.targetWidth;
      this.canvas.height = this.targetHeight;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public async detect(video: HTMLVideoElement): Promise<DetectionResult> {
    if (!video || video.readyState < 2 || !this.ctx || !this.canvas) {
      return {
        long_hair_detected: false,
        confidence: 0,
      };
    }

    const { targetWidth, targetHeight } = this;

    // Draw current frame into downsampled buffer for non-blocking analysis
    this.ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const frame = this.ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = frame.data;

    // Analyze spatial zones:
    // Zone 1: Scalp (y: 10% - 30%)
    // Zone 2: Jawline level (y: 45% - 60%)
    // Zone 3: Below jaw / Shoulder level (y: 60% - 85%)
    let scalpPixels = 0;
    let jawLevelHairPixels = 0;
    let shoulderLevelHairPixels = 0;
    let totalSampledScalp = 0;
    let totalSampledShoulder = 0;

    const yStartScalp = Math.floor(targetHeight * 0.10);
    const yEndScalp = Math.floor(targetHeight * 0.35);

    const yStartJaw = Math.floor(targetHeight * 0.45);
    const yEndJaw = Math.floor(targetHeight * 0.60);

    const yStartShoulder = Math.floor(targetHeight * 0.60);
    const yEndShoulder = Math.floor(targetHeight * 0.85);

    // Left and right bilateral hair columns (x: 10%-35% and 65%-90%)
    const leftX1 = Math.floor(targetWidth * 0.12);
    const leftX2 = Math.floor(targetWidth * 0.38);
    const rightX1 = Math.floor(targetWidth * 0.62);
    const rightX2 = Math.floor(targetWidth * 0.88);

    for (let y = yStartScalp; y < yEndShoulder; y++) {
      for (let x = leftX1; x < rightX2; x++) {
        // Sample every 2nd pixel for maximum speed
        if ((x + y) % 2 !== 0) continue;

        const idx = (y * targetWidth + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Is pixel skin tone? (Standard YCbCr rule for human skin color filtering)
        const isSkin = this.isSkinPixel(r, g, b);
        // Is pixel potential hair? (Contrasting pigmented or textured non-skin region)
        const isHair = !isSkin && this.isHairPixel(r, g, b);

        if (y >= yStartScalp && y < yEndScalp) {
          totalSampledScalp++;
          if (isHair) scalpPixels++;
        } else if (y >= yStartJaw && y < yEndJaw) {
          const isLateral = (x >= leftX1 && x <= leftX2) || (x >= rightX1 && x <= rightX2);
          if (isLateral && isHair) {
            jawLevelHairPixels++;
          }
        } else if (y >= yStartShoulder && y < yEndShoulder) {
          const isLateral = (x >= leftX1 && x <= leftX2) || (x >= rightX1 && x <= rightX2);
          totalSampledShoulder++;
          if (isLateral && isHair) {
            shoulderLevelHairPixels++;
          }
        }
      }
    }

    const scalpRatio = totalSampledScalp > 0 ? scalpPixels / totalSampledScalp : 0;
    const shoulderDensity = totalSampledShoulder > 0 ? shoulderLevelHairPixels / totalSampledShoulder : 0;

    // A person is visible in frame if scalp or facial area contains reasonable coverage
    const hasHeadPresence = scalpRatio > 0.15 || jawLevelHairPixels > 15;

    // Hair extending below jaw towards shoulders
    // Long hair criteria: bilateral lateral density below the jawline (y > 60%) exceeds threshold
    const hasLongHairBelowJaw = shoulderLevelHairPixels > 35 && shoulderDensity > 0.08;

    let confidence = 0.5;
    if (hasHeadPresence && hasLongHairBelowJaw) {
      // Calculate normalized confidence score (0.75 - 0.98)
      confidence = Math.min(0.98, Math.max(0.72, 0.65 + (shoulderDensity * 1.5) + (scalpRatio * 0.2)));
    } else if (hasHeadPresence) {
      confidence = Math.min(0.95, Math.max(0.68, 0.70 + (1 - shoulderDensity * 2) * 0.25));
    }

    const longHairDetected = hasHeadPresence && hasLongHairBelowJaw;

    return {
      long_hair_detected: longHairDetected,
      confidence: Number(confidence.toFixed(2)),
      metrics: {
        scalpCoverage: Number(scalpRatio.toFixed(2)),
        jawlineExtension: jawLevelHairPixels,
        shoulderLevelDensity: Number(shoulderDensity.toFixed(2)),
        contrastRatio: Number((scalpPixels / Math.max(1, shoulderLevelHairPixels)).toFixed(2)),
      },
    };
  }

  /**
   * Fast YCbCr human skin chrominance test
   */
  private isSkinPixel(r: number, g: number, b: number): boolean {
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
    return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
  }

  /**
   * Fast hair pixel heuristic (non-background, non-skin pigmented pixel)
   */
  private isHairPixel(r: number, g: number, b: number): boolean {
    const brightness = (r + g + b) / 3;
    // Hair can be dark (black/brown) or light (blonde/red/gray), but is distinct from pure white/black background
    const isVeryDark = brightness < 80;
    const isMediumToned = brightness >= 80 && brightness < 185 && Math.abs(r - g) < 50;
    return isVeryDark || isMediumToned;
  }

  public dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }
}

// Factory to allow swappable detectors
export function createHairDetector(): IHairDetector {
  return new VisionHairDetector();
}
