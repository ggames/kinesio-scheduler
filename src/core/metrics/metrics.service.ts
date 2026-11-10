import { Injectable } from '@nestjs/common';

type Labels = Record<string, string | number>;

interface HistogramState {
  count: number;
  sum: number;
  buckets: number[];
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramState>();

  increment(name: string, labels: Labels = {}, value = 1): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  observe(name: string, labels: Labels, seconds: number): void {
    const key = this.key(name, labels);
    const state = this.histograms.get(key) ?? {
      count: 0,
      sum: 0,
      buckets: DEFAULT_BUCKETS.map(() => 0),
    };
    state.count += 1;
    state.sum += seconds;
    DEFAULT_BUCKETS.forEach((bucket, index) => {
      if (seconds <= bucket) state.buckets[index] += 1;
    });
    this.histograms.set(key, state);
  }

  render(): string {
    const lines: string[] = [];

    const counterNames = new Set(
      [...this.counters.keys()].map((key) => key.split('{')[0]),
    );
    for (const name of counterNames) {
      lines.push(`# TYPE ${name} counter`);
      for (const [key, value] of this.counters) {
        if (key.startsWith(`${name}{`)) {
          lines.push(`${key} ${value}`);
        }
      }
    }

    const histogramNames = new Set(
      [...this.histograms.keys()].map((key) => key.split('{')[0]),
    );
    for (const name of histogramNames) {
      lines.push(`# TYPE ${name} histogram`);
      for (const [key, state] of this.histograms) {
        if (!key.startsWith(`${name}{`)) continue;
        const base = key.slice(name.length + 1, -1);
        DEFAULT_BUCKETS.forEach((bucket, index) => {
          const labels = base
            ? `${base},le="${bucket}"`
            : `le="${bucket}"`;
          lines.push(`${name}_bucket{${labels}} ${state.buckets[index]}`);
        });
        const infLabels = base ? `${base},le="+Inf"` : 'le="+Inf"';
        lines.push(`${name}_bucket{${infLabels}} ${state.count}`);
        lines.push(`${name}_sum{${base}} ${state.sum}`);
        lines.push(`${name}_count{${base}} ${state.count}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private key(name: string, labels: Labels): string {
    const entries = Object.entries(labels)
      .map(([key, value]) => `${key}="${escapeLabel(String(value))}"`)
      .join(',');
    return entries ? `${name}{${entries}}` : name;
  }
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
