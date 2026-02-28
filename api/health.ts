import { sendJson } from './_lib/http';

export default function handler(_req: any, res: any) {
  sendJson(res, 200, { status: 'ok' });
}

