import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { isAdminUser } from '@/lib/platform/supabase'
import { BRAND_EXPERT_TOOLS, executeBrandTool, buildBrandExpertSystemPrompt } from '@/lib/agents/brandExpert'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId || !isAdminUser(userId)) {
    return new Response(JSON.stringify({ error: 'Kein Zugriff — nur Admins' }), { status: 403 })
  }

  const { mode, input } = await req.json()
  if (!mode) {
    return new Response(JSON.stringify({ error: 'mode ist Pflichtfeld (weekly-scrape | brand-report | brand-check | brand-update)' }), { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const modeLabels: Record<string, string> = {
          'brand-setup':   '🚀 Brand Setup',
          'weekly-update': '🔄 Weekly Update',
          'brand-check':   '✅ Brand Check',
          'brand-update':  '💾 Brand Update',
        }
        send({ type: 'start', message: `${modeLabels[mode] ?? mode} startet...` })

        const systemPrompt = buildBrandExpertSystemPrompt(mode, input)

        const userMessage =
          mode === 'brand-setup'   ? "Starte den vollständigen Brand Setup für Sins 'n Lashes — baue die komplette Wissensbasis von Grund auf." :
          mode === 'weekly-update' ? "Starte den Weekly Update für Sins 'n Lashes — vergleiche mit dem gespeicherten Stand und markiere alle Änderungen." :
          mode === 'brand-check'   ? `Prüfe ob folgender Content on-brand ist: "${input ?? ''}"` :
                                     `Speichere folgende neue Brand-Information: "${input ?? ''}"`

        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]

        // Agentic Loop
        while (true) {
          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 8096,
            system:     systemPrompt,
            tools:      BRAND_EXPERT_TOOLS,
            messages,
          })

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send({ type: 'progress', message: block.text })
            }
          }

          if (response.stop_reason === 'end_turn') {
            send({ type: 'done', message: `${modeLabels[mode] ?? mode} abgeschlossen.` })
            break
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool', message: `🔧 ${block.name}...` })
              try {
                const result = await executeBrandTool(block.name, block.input as Record<string, unknown>)
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
