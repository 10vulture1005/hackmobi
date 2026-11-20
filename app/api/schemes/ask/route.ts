import { askSchemes } from '@/lib/ai/schemes'
import { isLanguage } from '@/lib/ai/provider'
import { db } from '@/lib/data/db'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok({ schemes: db().schemes })
}

export async function POST(req: Request) {
  const limited = rateLimit(req, 'schemes', 40)
  if (limited) return limited

  let body: {
    question?: string
    age?: number
    state?: string
    ration_card?: string
    income_band?: string
    condition?: string
    language?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }

  const answer = await askSchemes({
    question: body.question?.slice(0, 500),
    age: body.age ?? null,
    state: body.state ?? null,
    ration_card: body.ration_card ?? null,
    income_band: body.income_band ?? null,
    condition: body.condition ?? null,
    language: isLanguage(body.language) ? body.language : 'en',
  })

  return ok(answer)
}
