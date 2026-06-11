import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getWidgetConfig, logEscalation, WidgetConfig } from "@/lib/platform/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── CORS — Widget wird von fremden Domains eingebettet ───────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Widget-Token",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/widget-chat
// Body: { message: string, sessionId?: string }
// Header: X-Widget-Token: <uuid>
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  // ── 1. Widget-Token aus Header lesen ─────────────────────────────────────────
  const widgetToken = req.headers.get("X-Widget-Token");
  if (!widgetToken) {
    return Response.json(
      { error: "X-Widget-Token fehlt" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // ── 2. Konfiguration aus Supabase laden ───────────────────────────────────────
  const config = await getWidgetConfig(widgetToken);
  if (!config) {
    return Response.json(
      { error: "Ungültiger Widget-Token" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // ── 3. Request-Body ───────────────────────────────────────────────────────────
  const { message, sessionId } = await req.json();
  if (!message) {
    return Response.json(
      { error: "Nachricht fehlt" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;
  const envId = process.env.ANTHROPIC_ENVIRONMENT_ID!;

  if (!envId) {
    return Response.json(
      { error: "ANTHROPIC_ENVIRONMENT_ID nicht gesetzt" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    // ── 4. Session anlegen (erster Turn) oder fortsetzen ─────────────────────────
    let activeSessionId: string = sessionId;
    if (!activeSessionId) {
      const session = await beta.sessions.create({
        agent: config.anthropic_agent_id,
        environment_id: envId,
        title: `Support — ${config.shopify_shop ?? "shop"} — ${new Date().toISOString()}`,
      });
      activeSessionId = session.id;
    }

    // ── 5. Stream öffnen, dann User-Nachricht senden ──────────────────────────────
    const eventStream = await beta.sessions.events.stream(activeSessionId);
    await beta.sessions.events.send(activeSessionId, {
      events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          for await (const event of eventStream) {
            // ── Text streamen ────────────────────────────────────────────────────
            if (event.type === "agent.message.delta" && event.delta?.text) {
              enqueue({ text: event.delta.text });

            } else if (event.type === "agent.message" && Array.isArray(event.content)) {
              for (const block of event.content) {
                if (block?.type === "text" && typeof block.text === "string") {
                  enqueue({ text: block.text });
                }
              }

            // ── Tool-Ausführung ──────────────────────────────────────────────────
            } else if (event.type === "agent.tool_use") {
              const toolName = event.name as string;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const toolInput = (event.input ?? {}) as Record<string, any>;

              // Client über laufendes Tool informieren
              enqueue({ tool: toolName });

              // Tool ausführen
              const result = await executeTool(toolName, toolInput, config);

              // Ergebnis zurück an den Agent schicken
              await beta.sessions.events.send(activeSessionId, {
                events: [{
                  type: "tool_result",
                  tool_use_id: event.id,
                  content: [{ type: "text", text: JSON.stringify(result) }],
                }],
              });

            // ── Agent fertig ─────────────────────────────────────────────────────
            } else if (event.type === "session.status_idle") {
              break;
            }
          }

          enqueue({ done: true });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream-Fehler";
          enqueue({ error: msg });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
        "X-Session-Id":  activeSessionId,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "API-Fehler";
    return Response.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL-ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

async function executeTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  config: WidgetConfig
): Promise<object> {
  try {
    switch (name) {
      case "lookup_order":           return await lookupOrder(input.order_id, config);
      case "track_shipment":         return await trackShipment(input.tracking_nr, config);
      case "get_response_template":  return await getResponseTemplate(input.category, input.language, input.shopify_status, config);
      case "cancel_order":           return await cancelOrder(input.order_id, config);
      case "update_shipping_address":return await updateShippingAddress(input.order_id, input.address, config);
      case "create_refund":          return await createRefund(input.order_id, input.amount, input.reason, config);
      case "escalate_to_support":    return await escalateToSupport(input.reason, input.summary, input.customer_message, input.priority, config);
      default:
        return { error: `Unbekanntes Tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Tool '${name}' Fehler:`, msg);
    return { error: `Tool-Fehler: ${msg}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOPIFY TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

function shopifyHeaders(config: WidgetConfig) {
  return {
    "X-Shopify-Access-Token": config.shopify_access_token ?? "",
    "Content-Type": "application/json",
  };
}

function shopifyBase(config: WidgetConfig) {
  return `https://${config.shopify_shop}/admin/api/2024-10`;
}

async function lookupOrder(orderId: string, config: WidgetConfig) {
  if (!config.shopify_shop || !config.shopify_access_token) {
    return { error: "Shopify nicht konfiguriert" };
  }

  // Bestellnummer normalisieren — Shopify sucht mit name=#1001
  const name = orderId.startsWith("#") ? orderId : `#${orderId}`;

  const res = await fetch(
    `${shopifyBase(config)}/orders.json?name=${encodeURIComponent(name)}&status=any`,
    { headers: shopifyHeaders(config) }
  );

  if (!res.ok) return { error: `Shopify API Fehler: ${res.status}` };

  const data = await res.json();
  const orders = data.orders ?? [];

  if (orders.length === 0) return { found: false, message: "Bestellung nicht gefunden" };

  const o = orders[0];

  // Relevante Felder extrahieren
  const tracking = o.fulfillments?.[0]?.tracking_number ?? null;
  const trackingCompany = o.fulfillments?.[0]?.tracking_company ?? null;
  const trackingUrl = o.fulfillments?.[0]?.tracking_url ?? null;

  return {
    found:               true,
    order_id:            o.name,
    shopify_id:          o.id,
    financial_status:    o.financial_status,
    fulfillment_status:  o.fulfillment_status ?? "unfulfilled",
    total_price:         o.total_price,
    currency:            o.currency,
    created_at:          o.created_at,
    customer_email:      o.email,
    customer_name:       `${o.billing_address?.first_name ?? ""} ${o.billing_address?.last_name ?? ""}`.trim(),
    shipping_address:    o.shipping_address,
    line_items:          (o.line_items ?? []).map((i: Record<string, unknown>) => ({
      title:    i.title,
      quantity: i.quantity,
      price:    i.price,
    })),
    tracking_number:     tracking,
    tracking_company:    trackingCompany,
    tracking_url:        trackingUrl,
    tags:                o.tags,
    note:                o.note,
  };
}

async function cancelOrder(orderId: string, config: WidgetConfig) {
  if (!config.shopify_shop || !config.shopify_access_token) {
    return { error: "Shopify nicht konfiguriert" };
  }

  // Erst interne ID laden
  const order = await lookupOrder(orderId, config) as Record<string, unknown>;
  if (!order.found) return order;

  const res = await fetch(
    `${shopifyBase(config)}/orders/${order.shopify_id}/cancel.json`,
    {
      method: "POST",
      headers: shopifyHeaders(config),
      body: JSON.stringify({ reason: "customer" }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: `Stornierung fehlgeschlagen: ${JSON.stringify(err)}` };
  }

  return { success: true, message: `Bestellung ${orderId} wurde storniert` };
}

async function updateShippingAddress(
  orderId: string,
  address: Record<string, string>,
  config: WidgetConfig
) {
  if (!config.shopify_shop || !config.shopify_access_token) {
    return { error: "Shopify nicht konfiguriert" };
  }

  const order = await lookupOrder(orderId, config) as Record<string, unknown>;
  if (!order.found) return order;

  const res = await fetch(
    `${shopifyBase(config)}/orders/${order.shopify_id}.json`,
    {
      method: "PUT",
      headers: shopifyHeaders(config),
      body: JSON.stringify({ order: { shipping_address: address } }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: `Adressänderung fehlgeschlagen: ${JSON.stringify(err)}` };
  }

  return { success: true, message: `Lieferadresse für ${orderId} aktualisiert` };
}

async function createRefund(
  orderId: string,
  amount: number,
  reason: string,
  config: WidgetConfig
) {
  if (!config.shopify_shop || !config.shopify_access_token) {
    return { error: "Shopify nicht konfiguriert" };
  }

  const order = await lookupOrder(orderId, config) as Record<string, unknown>;
  if (!order.found) return order;

  const res = await fetch(
    `${shopifyBase(config)}/orders/${order.shopify_id}/refunds.json`,
    {
      method: "POST",
      headers: shopifyHeaders(config),
      body: JSON.stringify({
        refund: {
          note: reason,
          transactions: [{
            parent_id: null,   // Shopify ermittelt automatisch
            amount:    amount.toFixed(2),
            kind:      "refund",
            gateway:   "manual",
          }],
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: `Erstattung fehlgeschlagen: ${JSON.stringify(err)}` };
  }

  return {
    success: true,
    message: `Erstattung von ${amount} € für ${orderId} ausgelöst`,
    note:    "Gutschrift erscheint innerhalb von 5–7 Werktagen",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DHL TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

async function trackShipment(trackingNr: string, config: WidgetConfig) {
  if (!config.dhl_api_key) {
    return { error: "DHL API nicht konfiguriert" };
  }

  const res = await fetch(
    `https://api.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNr)}`,
    {
      headers: {
        "DHL-API-Key": config.dhl_api_key,
        "Accept":      "application/json",
      },
    }
  );

  if (!res.ok) return { error: `DHL API Fehler: ${res.status}` };

  const data = await res.json();
  const shipment = data.shipments?.[0];
  if (!shipment) return { found: false, message: "Keine Tracking-Daten gefunden" };

  const lastEvent = shipment.events?.[0];
  const eta = shipment.estimatedTimeOfDelivery;

  return {
    found:            true,
    tracking_number:  trackingNr,
    tracking_url:     `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${trackingNr}`,
    status:           shipment.status?.status ?? "unknown",
    status_code:      shipment.status?.statusCode ?? null,
    description:      shipment.status?.description ?? null,
    last_location:    lastEvent?.location?.address?.addressLocality ?? null,
    last_timestamp:   lastEvent?.timestamp ?? null,
    estimated_delivery: eta ?? null,
    events:           (shipment.events ?? []).slice(0, 5).map((e: Record<string, unknown>) => ({
      timestamp:   e.timestamp,
      location:    (e.location as Record<string, unknown>)?.address
                     ? ((e.location as Record<string, unknown>).address as Record<string, unknown>).addressLocality
                     : null,
      description: e.description,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRELLO — Antwortvorlagen
// ═══════════════════════════════════════════════════════════════════════════════

// Fallback-Vorlagen falls Trello nicht konfiguriert
const FALLBACK_TEMPLATES: Record<string, Record<string, string>> = {
  bestellung_status: {
    de: "Ihre Bestellung {bestell_nr} ist bei uns eingegangen und wird vorbereitet. Der Versand erfolgt in 1–2 Werktagen — Sie erhalten dann automatisch eine E-Mail mit der Tracking-Nummer.",
    en: "Your order {bestell_nr} has been received and is being prepared. We'll ship it within 1–2 business days and you'll receive a tracking email.",
    fr: "Votre commande {bestell_nr} a bien été reçue et est en cours de préparation. L'expédition aura lieu sous 1 à 2 jours ouvrés.",
    tr: "Siparişiniz {bestell_nr} alındı ve hazırlanıyor. 1-2 iş günü içinde kargoya verilecek ve takip numaranız e-posta ile iletilecektir.",
  },
  lieferung_dhl: {
    de: "Ihre Sendung {tracking_nr} befindet sich aktuell {dhl_status} ({dhl_ort}). Der Tracking-Link: {tracking_link}",
    en: "Your shipment {tracking_nr} is currently {dhl_status} ({dhl_ort}). Track it here: {tracking_link}",
    fr: "Votre colis {tracking_nr} est actuellement {dhl_status} ({dhl_ort}). Suivez-le ici : {tracking_link}",
    tr: "Kargonuz {tracking_nr} şu anda {dhl_status} ({dhl_ort}) konumundadır. Takip linki: {tracking_link}",
  },
  retoure_erstattung: {
    de: "Sie können die Ware bequem zurücksenden. Nach Eingang der Retoure erstatten wir {erstattung_betrag} € innerhalb von {erstattung_tage} Werktagen auf Ihr ursprüngliches Zahlungsmittel.",
    en: "You can return the item easily. Once we receive the return, we'll refund {erstattung_betrag} € within {erstattung_tage} business days.",
    fr: "Vous pouvez retourner l'article facilement. Dès réception, nous vous remboursons {erstattung_betrag} € sous {erstattung_tage} jours ouvrés.",
    tr: "Ürünü kolayca iade edebilirsiniz. İade alındıktan sonra {erstattung_betrag} € {erstattung_tage} iş günü içinde iade edilecektir.",
  },
  reklamation: {
    de: "Das tut mir leid — das sollte nicht passieren. Ich biete Ihnen an: Neulieferung oder vollständige Erstattung. Was bevorzugen Sie?",
    en: "I'm sorry about that — it shouldn't have happened. I can offer you a replacement or a full refund. Which do you prefer?",
    fr: "Je suis désolé pour cela — cela ne devrait pas arriver. Je vous propose un renvoi ou un remboursement complet. Que préférez-vous ?",
    tr: "Bunun için üzgünüm — böyle olmamalıydı. Size yeni gönderim veya tam iade sunabilirim. Hangisini tercih edersiniz?",
  },
  stornierung: {
    de: "Ihre Bestellung {bestell_nr} wurde erfolgreich storniert. Die Erstattung erscheint innerhalb von 5–7 Werktagen auf Ihrem Konto.",
    en: "Your order {bestell_nr} has been successfully cancelled. The refund will appear within 5–7 business days.",
    fr: "Votre commande {bestell_nr} a été annulée avec succès. Le remboursement apparaîtra sous 5 à 7 jours ouvrés.",
    tr: "Siparişiniz {bestell_nr} başarıyla iptal edildi. İade 5-7 iş günü içinde hesabınıza yansıyacaktır.",
  },
  adresse_aendern: {
    de: "Ich habe die Lieferadresse für Bestellung {bestell_nr} erfolgreich aktualisiert.",
    en: "I have successfully updated the delivery address for order {bestell_nr}.",
    fr: "J'ai mis à jour l'adresse de livraison pour la commande {bestell_nr}.",
    tr: "{bestell_nr} siparişi için teslimat adresini başarıyla güncelledim.",
  },
  unvertraeglichkeit: {
    de: "Bei Allergiefragen rate ich, direkt die Produktbeschreibung und das Etikett zu prüfen. Für medizinische Sicherheitsfragen leite ich Sie besser an unser Fachteam weiter.",
    en: "For allergy questions, I recommend checking the product description and label directly. For medical safety questions, I'll connect you with our specialist team.",
    fr: "Pour les questions d'allergie, je vous recommande de vérifier la description et l'étiquette du produit. Pour les questions de sécurité médicale, je vous mets en contact avec notre équipe spécialisée.",
    tr: "Alerji soruları için ürün açıklamasını ve etiketi doğrudan kontrol etmenizi öneririm. Tıbbi güvenlik soruları için uzman ekibimize yönlendireceğim.",
  },
  sonstiges: {
    de: "Ich kümmere mich darum. Können Sie mir etwas mehr dazu sagen, damit ich Ihnen direkt helfen kann?",
    en: "I'll take care of that. Could you tell me a bit more so I can help you directly?",
    fr: "Je m'en occupe. Pouvez-vous m'en dire un peu plus pour que je puisse vous aider directement ?",
    tr: "Bununla ilgileneceğim. Doğrudan yardımcı olabilmem için biraz daha bilgi verir misiniz?",
  },
};

async function getResponseTemplate(
  category: string,
  language: string,
  shopifyStatus: string | undefined,
  config: WidgetConfig
) {
  const lang = language || "de";

  // Trello verfügbar? Karte aus dem Board laden
  if (config.trello_key && config.trello_token && config.trello_board_id) {
    try {
      // Listen des Boards laden
      const listsRes = await fetch(
        `https://api.trello.com/1/boards/${config.trello_board_id}/lists?key=${config.trello_key}&token=${config.trello_token}`
      );
      if (listsRes.ok) {
        const lists = await listsRes.json();
        // Liste mit passendem Namen finden (z.B. "bestellung_status" oder "Bestellstatus")
        const targetList = lists.find(
          (l: Record<string, string>) =>
            l.name.toLowerCase().includes(category.replace("_", "")) ||
            l.name.toLowerCase().includes(category)
        );

        if (targetList) {
          const cardsRes = await fetch(
            `https://api.trello.com/1/lists/${targetList.id}/cards?key=${config.trello_key}&token=${config.trello_token}`
          );
          if (cardsRes.ok) {
            const cards = await cardsRes.json();
            // Karte in der richtigen Sprache finden
            const card = cards.find(
              (c: Record<string, string>) =>
                c.name.toLowerCase().includes(lang) ||
                c.name.toLowerCase().includes("vorlage") ||
                c.name.toLowerCase().includes("template")
            ) ?? cards[0];

            if (card) {
              return {
                source:   "trello",
                category,
                language: lang,
                template: card.desc || card.name,
                note:     shopifyStatus ? `Status: ${shopifyStatus}` : undefined,
              };
            }
          }
        }
      }
    } catch {
      // Trello-Fehler: Fallback auf lokale Vorlagen
    }
  }

  // Fallback: lokale Vorlagen
  const template =
    FALLBACK_TEMPLATES[category]?.[lang] ??
    FALLBACK_TEMPLATES[category]?.["de"] ??
    "Bitte nutzen Sie diese Antwort als Vorlage und passen Sie sie an.";

  return {
    source:   "fallback",
    category,
    language: lang,
    template,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESKALATION
// ═══════════════════════════════════════════════════════════════════════════════

async function escalateToSupport(
  reason: string,
  summary: string,
  customerMessage: string,
  priority: "HOCH" | "NORMAL",
  config: WidgetConfig
) {
  const timestamp = new Date().toISOString();

  // In Supabase loggen
  await logEscalation({
    organization_id:  config.organization_id,
    reason,
    summary,
    customer_message: customerMessage,
    priority,
    shop:             config.shopify_shop ?? "unbekannt",
    created_at:       timestamp,
  });

  // E-Mail senden (via Resend, falls API Key gesetzt)
  const resendKey = process.env.RESEND_API_KEY;
  const toEmail   = config.escalation_email;

  if (resendKey && toEmail) {
    const priorityLabel = priority === "HOCH" ? "🔴 KRITISCH" : "🟡 NORMAL";
    const emailBody = `
<h2>${priorityLabel} — Support-Eskalation</h2>
<p><strong>Shop:</strong> ${config.shopify_shop ?? "–"}</p>
<p><strong>Zeitpunkt:</strong> ${timestamp}</p>
<p><strong>Grund:</strong> ${reason}</p>
<hr/>
<h3>Zusammenfassung</h3>
<p>${summary}</p>
<h3>Letzte Kundennachricht</h3>
<blockquote>${customerMessage}</blockquote>
<hr/>
<p><em>Diese Nachricht wurde automatisch vom KANA AI Support Agent generiert.</em></p>
    `.trim();

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "support-agent@kanaai.de",
        to:      [toEmail],
        subject: `[${priority}] Support-Eskalation — ${config.shopify_shop ?? "Shop"}`,
        html:    emailBody,
      }),
    }).catch((err) => console.error("E-Mail-Versand fehlgeschlagen:", err));
  }

  return {
    success:       true,
    escalated_at:  timestamp,
    priority,
    response_time: priority === "HOCH" ? "4 Stunden" : "24 Stunden",
    message:       "Eskalation wurde weitergeleitet und protokolliert",
  };
}
