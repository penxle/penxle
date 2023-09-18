import 'dd-trace/init.js';

import { registerInstrumentations } from '@opentelemetry/instrumentation';
import ddtrace from 'dd-trace';

export const tracer = ddtrace;
export const provider = new tracer.TracerProvider();
provider.register();

registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [],
});