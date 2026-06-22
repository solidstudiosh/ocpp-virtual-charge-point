# Idempotent seed for cockpit charge scenarios — run via:
#   bundle exec rails runner <abs path>/charge_scenarios.rb
# in the platform repo. Safe to re-run every cockpit boot.
#
# Target station identity comes from SEED_IDENTITY (default "jasonborne").
# It ADOPTS an existing station with that identity (e.g. the renamed one you already
# control) and grafts the scenario cards onto its site; if none exists it builds a full
# dedicated station attached to the test CPO account (test@cpo.me) so it is visible.
#
# Prints, on its last line, a machine-readable manifest the cockpit parses:
#   __SCENARIOS__ <json array>

require "json"
begin
  require "factory_bot"
rescue LoadError
  # factory_bot not available — the seed falls back to plain ActiveRecord below.
end

IDENTITY = ENV.fetch("SEED_IDENTITY", "jasonborne")
log = ->(m) { warn "[seed] #{m}" }          # logs go to stderr, manifest to stdout
fb = defined?(FactoryBot) ? FactoryBot : nil

def future_date = (Date.today >> 120).to_s   # ~10 years ahead

# ---------------------------------------------------------------------------
# 1. Station (adopt existing identity, else build a dedicated one on test CPO)
# ---------------------------------------------------------------------------
station = ChargingStation.find_by(identity: IDENTITY)

if station
  log.("station '#{IDENTITY}' adoptée (id=#{station.id})")
  station.update!(commissioned_at: 1.year.ago) unless station.commissioned?
else
  raise "FactoryBot indisponible pour créer une station dédiée" unless fb
  cpo_account = Account.find_by(email: "test@cpo.me")
  cpo = cpo_account&.memberable
  cpo ||= ChargePointOperator.first || fb.create(:charge_point_operator)
  site_owner = SiteOwner.where(charge_point_operator: cpo).first || fb.create(:site_owner, charge_point_operator: cpo)
  site = fb.create(:site, name: "Cockpit Sim Site", site_owner: site_owner)
  station = fb.create(:charging_station, site: site, identity: IDENTITY, name: "Cockpit Sim Borne",
                                          is_public: false, mobilypass: false, commissioned_at: 1.year.ago)
  log.("station '#{IDENTITY}' créée (id=#{station.id}) sur CPO #{cpo.id}")
end

site = station.site

# Ensure a connector at point 1 + a tariff (needed by StartTransaction / TariffFinder)
connector = ChargeConnector.find_by(point: 1, charge_point_id: station.charge_points.ids)
if connector.nil? && fb
  cp = station.charge_points.first || fb.create(:charge_point, charging_station: station)
  connector = fb.create(:charge_connector, charge_point: cp, point: 1)
  log.("connecteur point=1 créé")
end

# ---------------------------------------------------------------------------
# 2. Mobilypass issuer
# ---------------------------------------------------------------------------
mobilypass_mo = MobilityOperation.mobilypass ||
                (fb ? fb.create(:mobility_operation, emi3: ENV.fetch("MOBILYGREEN_EMSP", "FR*MPS")) : nil)
raise "MobilityOperation mobilypass introuvable et FactoryBot indisponible" if mobilypass_mo.nil?

# ---------------------------------------------------------------------------
# Scenario A — Mobilypass card owned by a billable customer (Stripe TEST)
# ---------------------------------------------------------------------------
MOBI_UID = "FACECAFE01" # hex (UID_CARD_FORMAT = /\A\h*\z/)
mobi_status = "blocked"
begin
  email = "cockpit-sim-customer@evseem.local"
  account = Account.find_by(email: email)
  customer = account&.memberable
  if customer.nil?
    raise "FactoryBot indisponible pour créer le customer" unless fb
    customer = fb.create(:customer,
                         account: fb.build(:account, email: email, first_name: "Sim", last_name: "Customer"),
                         mobility_operation: mobilypass_mo)
  end
  customer.update!(main_street: "1 rue du Test", main_city: "Toulouse",
                   main_postal_code: "31000", main_country: "France")

  # Stripe TEST: create a customer + attach a test card so has_valid_card? is true.
  # (the customer factory seeds a fake "stripe_id" string — only "cus_…" is real)
  unless customer.stripe_id.to_s.start_with?("cus_")
    sc = Stripe::Customer.create(name: "#{customer.account.first_name} #{customer.account.last_name}",
                                 email: customer.account.email, preferred_locales: ["fr"])
    customer.update!(stripe_id: sc.id)
    log.("stripe test customer créé #{sc.id}")
  end
  pms = Stripe::PaymentMethod.list(customer: customer.stripe_id, type: "card")
  if pms.data.empty?
    pm = Stripe::PaymentMethod.attach("pm_card_visa", customer: customer.stripe_id)
    Stripe::Customer.update(customer.stripe_id, invoice_settings: { default_payment_method: pm.id })
    log.("carte de test attachée #{pm.id}")
  end
  customer.update!(has_payment_method: true, has_unpaid_invoices: false, status: :validated)

  card = UidCard.find_or_initialize_by(uid: MOBI_UID)
  card.assign_attributes(issuer: mobilypass_mo, user: customer, status: "enable",
                         validity_date: future_date, virtual: true, roaming: true)
  card.save!
  UidCardSiteAuthorization.find_or_create_by!(uid_card: card, site: site)
  mobi_status = "accepted"
  log.("scénario Mobilypass prêt (uid #{MOBI_UID}, customer #{customer.id})")
rescue => e
  log.("scénario Mobilypass indisponible (Stripe ?) : #{e.class} #{e.message}")
end

# ---------------------------------------------------------------------------
# Scenario D — Owner card (no Stripe): authorised via "private charge from owner"
# ---------------------------------------------------------------------------
OWNER_UID = "0FF1CE5501" # hex
owner_status = "blocked"
begin
  owner = site.site_owner
  if owner
    card = UidCard.find_or_initialize_by(uid: OWNER_UID)
    card.assign_attributes(issuer: (station.charge_point_operator || mobilypass_mo), user: owner,
                           status: "enable", validity_date: future_date, virtual: true, roaming: false)
    card.save!
    owner_status = "accepted"
    log.("scénario carte propriétaire prêt (uid #{OWNER_UID}, owner #{owner.id})")
  end
rescue => e
  log.("scénario carte propriétaire indisponible : #{e.class} #{e.message}")
end

# ---------------------------------------------------------------------------
# Scenario B — Foreign card: ensure NO record exists → refused on private station
# ---------------------------------------------------------------------------
FOREIGN_UID = "DEADBEEF01" # hex, intentionally not in our DB
UidCard.where(uid: FOREIGN_UID).delete_all

# ---------------------------------------------------------------------------
# Manifest (whitelist SIMTAG needs no data)
# ---------------------------------------------------------------------------
scenarios = [
  { id: "mobilypass", label: "Mobilypass + customer (Stripe test)", idTag: MOBI_UID,
    expected: mobi_status, note: "Carte Mobilypass d'un customer billable. Autorisée." },
  { id: "owner", label: "Carte propriétaire du site (sans Stripe)", idTag: OWNER_UID,
    expected: owner_status, note: "Carte du site owner — charge privée autorisée, sans paiement." },
  { id: "whitelist", label: "Tag whitelist (SIMTAG)", idTag: "SIMTAG",
    expected: "accepted", note: "Tag whitelist accepté sans carte sur station privée." },
  { id: "foreign", label: "Carte externe inconnue", idTag: FOREIGN_UID,
    expected: "blocked", note: "Carte pas de chez nous → refusée sur station privée." },
]

log.("station=#{IDENTITY} public?=#{station.is_public?} commissioned?=#{station.commissioned?}")
puts "__SCENARIOS__ #{scenarios.to_json}"
