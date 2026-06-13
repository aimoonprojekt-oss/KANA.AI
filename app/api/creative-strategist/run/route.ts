import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { isAdminUser } from '@/lib/platform/supabase'
import { CREATIVE_STRATEGIST_TOOLS, executeStrategistTool, buildStrategistSystemPrompt } from '@/lib/agents/creativeStrategist'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId || !isAdminUser(userId)) {
    return new Response(JSON.stringify({ error: 'Kein Zugriff — nur Admins' }), { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const mode: "20" | "10" | "2" = ["20","10","2"].includes(body?.mode) ? body.mode : "20"

  const briefLabel = mode === "20" ? "20 Creative Briefs" : mode === "10" ? "10 Creative Briefs (5 Image + 5 Video)" : "2 Creative Briefs (1 Image + 1 Video)"

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'start', message: `🎯 Creative Strategist startet — ${briefLabel}...` })

        const messages: Anthropic.MessageParam[] = [{
          role: 'user',
          content: `Erstelle den Ad Strategy Guide für Sins 'n Lashes mit exakt ${briefLabel} — lade Brand Knowledge und REF-Dateien, wende das 5 Stages Framework an und entwickle die Briefs.`
        }]

        while (true) {
          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: mode === "2" ? 6000 : mode === "10" ? 10000 : 16000,
            system:     buildStrategistSystemPrompt(mode),
            tools:      CREATIVE_STRATEGIST_TOOLS,
            messages,
          })

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send({ type: 'progress', message: block.text })
            }
          }

          if (response.stop_reason === 'end_turn') {
            send({ type: 'done', message: '✅ Strategy Guide fertig.' })
            break
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool', message: `🔧 ${block.name}...` })
              try {
                const result = await executeStrategistTool(block.name, block.input as Record<string, unknown>)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
                send({ type: 'tool_done', message: `✅ ${block.name}` })
              } catch (err) {
                const errMsg = String(err)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Fehler: ${errMsg}`, is_error: true })
                send({ type: 'tool_error', message: `❌ ${block.name}: ${errMsg}` })
              }
            }
          }

          messages.push({ role: 'assistant', content: response.content })
          messages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        send({ type: 'error', message: `Fehler: ${String(err)}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
