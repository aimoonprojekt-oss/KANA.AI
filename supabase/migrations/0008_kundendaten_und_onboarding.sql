-- ═══════════════════════════════════════════════════════════════════════════════
-- 0008_kundendaten_und_onboarding.sql
--
-- Bisher wusste die Plattform von einem Kunden genau zwei Dinge: seine
-- Clerk-User-ID und seine E-Mail. Die Organisation hiess "org_user_3F2YY...".
-- Fuer eine Rechnung mit Umsatzsteuerausweis reicht das nicht, und fuer das
-- Onboarding eines Workspace erst recht nicht.
--
-- Entscheidung vom 18.08.2026: Die Anmeldung bleibt so niedrigschwellig wie
-- moeglich — E-Mail und Passwort, sonst nichts. Die Firmendaten werden erst
-- beim KAUF erhoben, und zwar auf der Stripe-Seite, auf der der Kunde ohnehin
-- gerade eine Rechnungsadresse eintippt. Kein eigenes Formular davor: Jede
-- Seite zwischen "kaufen" und "bezahlt" kostet Abschluesse.
--
-- Alle Felder sind nullable. Ein Konto ohne Kauf hat sie schlicht nicht.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.organizations
  add column if not exists firma              text,
  add column if not exists ansprechpartner    text,
  add column if not exists telefon            text,
  add column if not exists website            text,
  add column if not exists ust_id             text,
  add column if not exists rechnungsanschrift jsonb,
  add column if not exists onboarding_status  text
      check (onboarding_status in ('offen','laeuft','fertig')),
  add column if not exists onboarding_notiz   text,
  add column if not exists erstkauf_am        timestamptz;

comment on column public.organizations.firma is
  'Firmenname aus dem Checkout. Nicht zu verwechseln mit name — das ist der technische Bezeichner org_<userid>.';
comment on column public.organizations.rechnungsanschrift is
  'Adresse wie von Stripe erhoben: {line1,line2,postal_code,city,state,country}. Bewusst als jsonb — die Form unterscheidet sich je Land, und wir rechnen nicht damit.';
comment on column public.organizations.ust_id is
  'Umsatzsteuer-ID, von Stripe erhoben und dort auch geprueft.';
comment on column public.organizations.onboarding_status is
  'offen = hat gekauft, Workspace fehlt noch. laeuft = wird gerade aufgesetzt. fertig = Workspace, Schluessel und Ausgabenlimit stehen. NULL = hat nie gekauft.';
comment on column public.organizations.erstkauf_am is
  'Zeitpunkt des ersten Kaufs. Beantwortet "wie lange wartet dieser Kunde schon auf sein Onboarding".';

-- Die Arbeitsliste: wer wartet, und seit wann.
create index if not exists organizations_onboarding_offen_idx
  on public.organizations (erstkauf_am)
  where onboarding_status in ('offen','laeuft');

commit;

-- Gegenprobe — die Arbeitsliste, die spaeter in den Admin gehoert:
--   select firma, ansprechpartner, erstkauf_am, onboarding_status
--     from public.organizations
--    where onboarding_status in ('offen','laeuft')
--    order by erstkauf_am;
