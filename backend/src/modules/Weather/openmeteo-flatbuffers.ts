import { WeatherApiResponse } from '@openmeteo/sdk/weather-api-response';
import { ByteBuffer } from 'flatbuffers';

type OpenMeteoScalar = string | number | boolean;
type OpenMeteoParams = Record<
  string,
  OpenMeteoScalar | readonly OpenMeteoScalar[] | undefined
>;

const INVALID_PAYLOAD = 'Open-Meteo returned invalid FlatBuffers payload';

function decodeErrorReason(bytes: Uint8Array): string | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'reason' in parsed &&
      typeof parsed.reason === 'string'
    ) {
      return parsed.reason.slice(0, 300);
    }
  } catch {
    // The HTTP status remains useful when the upstream body is not JSON.
  }
  return null;
}

function decodeResponses(bytes: Uint8Array): WeatherApiResponse[] {
  const buffer = new ByteBuffer(bytes);
  const responses: WeatherApiResponse[] = [];
  let position = 0;

  while (position < buffer.capacity()) {
    if (buffer.capacity() - position < 4) {
      throw new Error(INVALID_PAYLOAD);
    }
    const length = buffer.readInt32(position);
    if (length <= 0 || length > buffer.capacity() - position - 4) {
      throw new Error(INVALID_PAYLOAD);
    }

    buffer.setPosition(position);
    responses.push(
      WeatherApiResponse.getSizePrefixedRootAsWeatherApiResponse(buffer),
    );
    position += length + 4;
  }

  if (responses.length === 0) {
    throw new Error(INVALID_PAYLOAD);
  }
  return responses;
}

/**
 * Strict transport/framing around the installed SDK reader.
 *
 * openmeteo 1.2.3 attempts to decode several non-OK responses as FlatBuffers.
 * Checking HTTP status and size prefixes here prevents an upstream JSON/HTML
 * error from being misreported as a forecast with missing blocks.
 */
export async function fetchOpenMeteoFlatbuffers(
  url: string,
  params: OpenMeteoParams,
  init?: RequestInit,
): Promise<WeatherApiResponse[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  query.set('format', 'flatbuffers');

  const response = await fetch(`${url}?${query.toString()}`, init);
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok) {
    const detail = decodeErrorReason(bytes) ?? response.statusText.trim();
    throw new Error(
      `Open-Meteo HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  return decodeResponses(bytes);
}
