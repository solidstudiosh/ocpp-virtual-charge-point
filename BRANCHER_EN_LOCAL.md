# Brancher la borne virtuelle (VCP) sur platform en local

Piloter une borne virtuelle depuis le dashboard platform local, comme on le faisait
avec une borne physique de test : on lui donne l'`identity` d'une borne connue de la
base, et les actions OCPP du dashboard agissent dessus.

On utilise l'identity **`jasonborne`** (nom volontairement bidon, ne collisionne jamais
avec une vraie borne).

---

## Architecture : le pont, c'est Redis

Les 3 briques ne se parlent **pas directement** — elles passent par **Redis pub/sub**.

```
┌──────────────┐   WebSocket (ocpp1.6)   ┌─────────────────┐   Redis pub/sub    ┌──────────────────────┐
│ VCP          │  ws://localhost:3334/   │ websocket       │   ocpp-req  ─────►  │ platform             │
│ (borne)      │ ◄──── /jasonborne ────► │ (Sinatra+faye)  │   ◄──── ocpp-conf   │ Ocpp::V16::Ws.start  │
│ index_16.ts  │                         │ puma -p 3334    │                     │ + sidekiq + web      │
└──────────────┘                         └─────────────────┘                     └──────────────────────┘
```

- **Borne → dashboard** : la VCP envoie un message OCPP → `websocket` le publie sur
  Redis `ocpp-req` → platform (`Ocpp::V16::Ws.start`) le consomme et met à jour la base.
- **Dashboard → borne** : une action (Reset, RemoteStart…) publie sur Redis `ocpp-conf`
  `{ charging_station_id: identity, conf: [...] }` → `websocket` la pousse au client WS
  dont le path == `identity`.

**La clé = l'`identity`** : le `CP_ID` de la VCP (segment du path WS) doit être égal à
`ChargingStation.identity` côté platform. Sinon : borne rejetée + Hard Reset en boucle.

Tout est en **OCPP 1.6** (le serveur websocket force le sous-protocole `ocpp1.6`).
La v2.0.1/2.1 demanderait de patcher le header du serveur websocket.

---

## Prérequis

- **Redis** sur `localhost:6379` (partagé par platform ET websocket). En général **déjà
  lancé** chez toi (c'est lui qu'utilise Sidekiq) — vérifie avec `redis-cli ping` → `PONG`.
  Rien à lancer s'il répond déjà.
- **Node 18+** (pour la VCP).
- platform et websocket déjà installés (gérés dans leurs dossiers respectifs).
- Même `REDIS_URL=redis://localhost:6379` partout.

---

## Étape 0 — Créer la borne `jasonborne` côté platform (une seule fois)

La borne doit exister en base, opérée par un CPO visible sur ton dashboard. Le plus
simple : recopier l'identity sur une borne de test **déjà opérée**, dans une console
platform (`bundle exec rails c`) :

```ruby
# Réutiliser une borne existante déjà opérée (la rend pilotable immédiatement)
cs = ChargingStation.where.not(identity: nil).first   # ou cible une borne précise de ton CPO de test
cs.update!(identity: "jasonborne")
puts cs.reload.identity   # => "jasonborne"
```

> Vérifie que cette borne est bien rattachée à un site / réseau visible sur ton compte
> dashboard, sinon tu ne verras pas ses actions.

---

## Étape 1 — Serveur websocket (dossier `websocket/`)

```bash
REDIS_URL=redis://localhost:6379 bundle exec puma -p 3334
```

## Étape 2 — platform : 3 terminaux (dossier `platform/`)

```bash
# Terminal A — subscriber OCPP entrant (consomme Redis ocpp-req)
#   PAS dans Procfile.dev → à lancer à la main
REDIS_URL=redis://localhost:6379 bundle exec rails runner 'Ocpp::V16::Ws.start'

# Terminal B — Sidekiq (traite les jobs : StartTransaction, MeterValues, ClearCache…)
bundle exec sidekiq -C ./config/sidekiq.development.yml

# Terminal C — web + vite (le dashboard)
bin/rails server -p 3000
bin/vite dev
```

> Sidekiq ≠ Redis : Sidekiq *consomme* Redis, il ne le fournit pas.
> Sidekiq ≠ le subscriber : lancer Sidekiq ne lance PAS `Ocpp::V16::Ws.start`.
> Les commandes simples (Reset, RemoteStart…) marchent sans Sidekiq, mais les
> transactions / meter values entrantes ne se finalisent que si Sidekiq tourne.

## Étape 3 — La borne virtuelle (dossier de ce repo, `evseem/`)

```bash
npm install        # première fois seulement

WS_URL=ws://localhost:3334 CP_ID=jasonborne npx tsx index_16.ts
```

Ou via un fichier `.env` (`WS_URL=...`, `CP_ID=jasonborne`) puis `npx tsx index_16.ts`.

---

## Vérifier que ça marche

1. Au lancement de la VCP, son terminal log un `BootNotification` envoyé puis une réponse
   `{"status":"Accepted", ...}` reçue → la borne est reconnue par platform. ✅
   (Si tu vois `Rejected` puis des `Reset {type:"Hard"}` en boucle → l'identity n'existe
   pas en base : refais l'étape 0.)
2. Sur le dashboard, ouvre la borne `jasonborne` → elle apparaît en ligne / Available.
3. Déclenche une action (Soft Reset, RemoteStart…) → le message apparaît dans le terminal
   de la VCP, qui répond.

Pour des actions initiées par la borne (Authorize, StartTransaction…), voir le dossier
`admin/` (endpoint admin de la VCP) : `npx tsx admin/v16/Authorize/authorize.ts`.

---

## Dépannage rapide

| Symptôme | Cause probable |
|---|---|
| VCP : `Rejected` + `Reset {Hard}` en boucle | `identity` absente de la base platform → étape 0 |
| Dashboard ne reçoit rien de la borne | Le subscriber `Ocpp::V16::Ws.start` (Terminal A) n'est pas lancé |
| Transaction / meter values jamais finalisées | Sidekiq (Terminal B) n'est pas lancé |
| Actions dashboard sans effet sur la VCP | websocket pas lancé, ou VCP connectée à un autre `WS_URL`/`CP_ID` |
| Connexion WS refusée / fermée aussitôt | Sous-protocole : la VCP doit être en OCPP 1.6 (`index_16.ts`) |
| `URI::InvalidURIError` au boot platform/websocket | `REDIS_URL` non défini dans l'environnement du process |

---

## Mémo des fichiers de référence

- VCP : `index_16.ts`, `src/vcp.ts` (connexion `ws://endpoint/CP_ID`, sous-protocole).
- websocket : `middlewares/ocpp_backend.rb` (sub `ocpp-conf` → client WS, msg WS → pub `ocpp-req`).
- platform entrant : `app/services/ocpp/v16/ws.rb` (sub `ocpp-req`), `handle_request.rb` (lookup par `identity`).
- platform sortant : `app/services/ocpp/v16/command_dispatcher.rb` + `ws_conf.rb` (pub `ocpp-conf`).
