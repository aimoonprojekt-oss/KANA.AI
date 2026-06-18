import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { isAdminUser } from '@/lib/platform/supabase'
import { CREATIVE_ANALYST_TOOLS, executeAnalystTool, buildAnalystSystemPrompt } from '@/lib/agents/creativeAnalyst'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId || !isAdminUser(userId)) {
    return new Response(JSON.stringify({ error: 'Kein Zugriff — nur Admins' }), { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const sessionIds: string[] = body.sessionIds ?? []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'start', message: '🔬 Creative Analyst startet...' })

        if (sessionIds.length > 0) {
          send({ type: 'progress', message: `🔒 Session-Filter aktiv: nur Ads aus Session(s) ${sessionIds.join(', ')} werden analysiert.` })
        } else {
          send({ type: 'progress', message: '📂 Kein Session-Filter — alle unanalysierten Ads werden geladen.' })
        }

        const messages: Anthropic.MessageParam[] = [{
          role: 'user',
          content: sessionIds.length > 0
            ? `Starte die SNL Creative Analyse. Rufe zuerst read_analyst_refs auf, dann read_brand_knowledge, dann read_breakdowns (die Daten sind bereits auf Session ${sessionIds.join(', ')} gefiltert — du erhältst NUR die Ads dieser Session). Analysiere AUSSCHLIESSLICH die Ads die read_breakdowns zurückgibt — keine anderen. Führe K1-K6 Scoring durch und speichere jede Analyse mit save_analysis.`
            : "Starte die SNL Creative Analyse: lade REF-Dateien, lese alle ausstehenden Breakdowns aus der Datenbank, führe K1-K6 Scoring durch und speichere jede Analyse."
        }]

        while (true) {
          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 16000,
            system:     buildAnalystSystemPrompt(),
            tools:      CREATIVE_ANALYST_TOOLS,
            messages,
          })

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send({ type: 'progress', message: block.text })
            }
          }

          if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
            send({ type: 'done', message: '✅ Analyse abgeschlossen.' })
            break
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool', message: `🔧 ${block.name}...` })
              try {
                // Für read_breakdowns: sessionIds aus dem Request IMMER erzwingen — Agent darf das nicht ignorieren
                const toolInput = block.name === 'read_breakdowns' && sessionIds.length > 0
                  ? { ...(block.input as Record<string, unknown>), sessionIds }
                  : block.input as Record<string, unknown>
                const result = await executeAnalystTool(block.name, toolInput)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
                send({ type: 'tool_done', message: `✅ ${block.name}` })
              } catch (err) {
                const errMsg = String(err)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Fehler: ${errMsg}`, is_error: true })
                send({ type: 'tool_error', message: `❌ ${block.name}: ${errMsg}` })
              }
            }
          }

          if (toolResults.length === 0) break

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
