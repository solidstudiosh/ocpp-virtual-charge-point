# Resolver for cockpit charge scenarios — run via:
#   bundle exec rails runner <abs path>/charge_scenarios.rb
# in the platform repo. READ-ONLY: it never mutates the platform DB.
#
# Scenarios = pick one of two EXISTING Mobilypass users (resolved by email) or the SIMTAG
# whitelist tag, to launch a charge. The users already exist with their cards — we only look up
# their Mobilypass UID and hand it to the cockpit as the idTag.
#
# Prints, on its last line, a machine-readable manifest the cockpit parses:
#   __SCENARIOS__ <json array>

require "json"

log = ->(m) { warn "[seed] #{m}" } # logs go to stderr, manifest to stdout

# The two existing Mobilypass users offered as charge scenarios.
USERS = [
  { id: "js",  label: "JS",  email: "faurejs@gmail.com" },
  { id: "max", label: "Max", email: "mbrachet@mobilygreen.fr" },
]

# Resolve a user's enabled Mobilypass card UID (most recent), read-only.
def resolve_card(email)
  user = Account.find_by(email: email)&.memberable
  return nil unless user

  cards = UidCard.mobilypass.where(user: user)
  cards.where(status: UidCard.statuses[:enable]).order(:created_at).last || cards.order(:created_at).last
end

scenarios = USERS.map do |u|
  card = begin
    resolve_card(u[:email])
  rescue => e
    log.("résolution carte #{u[:email]} : #{e.class} #{e.message}")
    nil
  end

  if card.nil?
    log.("aucune carte Mobilypass pour #{u[:email]} dans cette base")
    next { id: u[:id], label: "#{u[:label]} — Mobilypass (introuvable)", idTag: "",
           expected: "unknown", note: "Aucune carte Mobilypass pour #{u[:email]} dans cette base." }
  end

  log.("scénario #{u[:label]} : uid #{card.uid} (#{u[:email]})")
  { id: u[:id], label: "#{u[:label]} — Mobilypass", idTag: card.uid, expected: "accepted",
    note: "Carte Mobilypass de #{u[:label]} (#{u[:email]}). Acceptation selon la config de la station." }
end

# SIMTAG whitelist — accepted without data on a private commissioned station only.
scenarios << { id: "whitelist", label: "SIMTAG — whitelist", idTag: "SIMTAG", expected: "accepted",
               note: "Tag whitelist — accepté uniquement sur station privée commissionnée." }

puts "__SCENARIOS__ #{scenarios.to_json}"
