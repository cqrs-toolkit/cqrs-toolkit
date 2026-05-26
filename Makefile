CACHE = ./scripts/cache-run.sh
DOCS = ./scripts/docs-run.sh
WITH_HM_SERVER = ./demos/hypermedia-server/scripts/with-server.sh
.PHONY: build docs clean clean-cache hm-server-docs hm-client-init hm-client-pull

# -----------------------------------------------------------------------------
# Build-cache dependency rule
# -----------------------------------------------------------------------------
# Each `$(CACHE)` / `$(DOCS)` invocation lists the package's in-repo deps as
# space-separated names after the package directory. These names MUST mirror
# the workspace deps declared in the package's `package.json` (the
# `@cqrs-toolkit/*` entries under `dependencies` / `devDependencies` /
# `peerDependencies`, with the `@cqrs-toolkit/` prefix stripped).
#
# Drift causes silent stale-cache builds: a downstream package keeps being
# marked "up to date" when an upstream changes. When you add/remove a
# workspace dep in any `package.json`, update the corresponding target's
# dep list here in the same change. See
# `docs/playbooks/adding-a-new-package.md` step 9 for the convention; the
# same rule applies when modifying an existing package's deps.
#
# Sanity check (run any time you touch package deps):
#   for pkg in packages/*/package.json demos/*/package.json; do
#     node -e "const p=require('./'+'$$pkg');const a={...p.dependencies,...p.devDependencies,...p.peerDependencies};console.log('$$pkg:', Object.keys(a).filter(k=>k.startsWith('@cqrs-toolkit/')).map(k=>k.replace('@cqrs-toolkit/','')).sort().join(' '));"
#   done
# -----------------------------------------------------------------------------

build-realtime:
	$(CACHE) packages/realtime -- npm run build -w packages/realtime
build-schema:
	$(CACHE) packages/schema -- npm run build -w packages/schema
build-hypermedia:
	$(CACHE) packages/hypermedia schema -- npm run build -w packages/hypermedia
build-hypermedia-cli:
	$(CACHE) packages/hypermedia-cli hypermedia hypermedia-client -- npm run build -w packages/hypermedia-cli
build-hypermedia-client:
	$(CACHE) packages/hypermedia-client client hypermedia -- npm run build -w packages/hypermedia-client
build-client:
	$(CACHE) packages/client realtime -- npm run build -w packages/client
build-client-solid:
	$(CACHE) packages/client-solid client -- npm run build -w packages/client-solid
build-client-electron:
	$(CACHE) packages/client-electron client -- npm run build -w packages/client-electron
build-devtools:
	$(CACHE) packages/devtools client -- npm run build -w packages/devtools
build-demo-base:
	$(CACHE) demos/base client client-solid -- npm run build -w @cqrs-toolkit/demo-base
build-hypermedia-base:
	$(CACHE) demos/hypermedia-base client client-solid demo-base hypermedia-cli hypermedia-client -- npm run build -w @cqrs-toolkit/hypermedia-base

COMPILE = CACHE_NS=compile $(CACHE)

compile-todo-demo:
	$(CACHE) demos/todo-demo client client-solid demo-base realtime -- npx tsc -p demos/todo-demo/tsconfig.json --noEmit
	./demos/todo-demo/scripts/cache-server-compile.sh
compile-hypermedia-server:
	$(CACHE) demos/hypermedia-server demo-base hypermedia hypermedia-cli realtime schema -- npx tsc -p demos/hypermedia-server/tsconfig.json --noEmit
compile-hypermedia-web:
	$(CACHE) demos/hypermedia-web client client-solid hypermedia-base -- npx tsc -p demos/hypermedia-web/tsconfig.json --noEmit

clean:
	./scripts/clean.sh

clean-cache:
	rm -rf node_modules/.cache/build-hashes node_modules/.cache/compile-hashes node_modules/.cache/docs-hashes

docs-realtime:
	$(DOCS) packages/realtime -- npm run docs -w packages/realtime
docs-schema:
	$(DOCS) packages/schema -- npm run docs -w packages/schema
docs-hypermedia:
	$(DOCS) packages/hypermedia schema -- npm run docs -w packages/hypermedia
docs-client:
	$(DOCS) packages/client realtime -- npm run docs -w packages/client
docs-client-electron:
	$(DOCS) packages/client-electron client -- npm run docs -w packages/client-electron
docs-client-solid:
	$(DOCS) packages/client-solid client -- npm run docs -w packages/client-solid
docs-hypermedia-client:
	$(DOCS) packages/hypermedia-client client hypermedia -- npm run docs -w packages/hypermedia-client
docs-hypermedia-server-meta:
	$(CACHE) demos/hypermedia-server demo-base hypermedia hypermedia-cli realtime schema -- npm run cqrs:server:docs -w @cqrs-toolkit/hypermedia-server

docs:
	@rm -f node_modules/.cache/docs-hashes/docs-staged
	make -j docs-realtime docs-schema docs-hypermedia docs-client docs-client-electron docs-client-solid docs-hypermedia-client
	@./scripts/docs-stage.sh
	make docs-hypermedia-server-meta

build:
	make -j build-realtime build-schema
	make build-hypermedia
	make build-client
	make -j build-client-solid build-client-electron build-hypermedia-client
	make build-hypermedia-cli
	make build-demo-base
	make -j build-devtools build-hypermedia-base compile-todo-demo compile-hypermedia-server
	make compile-hypermedia-web

hm-start-electron:
	$(WITH_HM_SERVER) npm run start -w @cqrs-toolkit/hypermedia-electron

hm-server-docs:
	npm run cqrs:server:docs -w @cqrs-toolkit/hypermedia-server
	npm run cqrs:server:titles -w @cqrs-toolkit/hypermedia-server

hm-client-init:
	$(WITH_HM_SERVER) npm run cqrs:client:init -w @cqrs-toolkit/hypermedia-base

hm-client-pull:
	$(WITH_HM_SERVER) npm run cqrs:client:pull -w @cqrs-toolkit/hypermedia-base
