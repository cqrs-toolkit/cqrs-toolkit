CACHE = ./scripts/cache-run.sh
DOCS = ./scripts/docs-run.sh
WITH_HM_SERVER = ./demos/hypermedia-demo/scripts/with-server.sh
.PHONY: build docs clean-cache hm-generate hm-init

build-realtime:
	$(CACHE) packages/realtime -- npm run build -w packages/realtime
build-schema:
	$(CACHE) packages/schema -- npm run build -w packages/schema
build-hypermedia:
	$(CACHE) packages/hypermedia -- npm run build -w packages/hypermedia
build-hypermedia-client:
	$(CACHE) packages/hypermedia-client -- npm run build -w packages/hypermedia-client
build-client:
	$(CACHE) packages/client realtime -- npm run build -w packages/client
build-client-solid:
	$(CACHE) packages/client-solid client -- npm run build -w packages/client-solid
build-devtools:
	$(CACHE) packages/devtools client -- npm run build -w packages/devtools
COMPILE = CACHE_NS=compile $(CACHE)

compile-todo-demo:
	$(CACHE) demos/todo-demo client client-solid -- npx tsc -p demos/todo-demo/tsconfig.json --noEmit
	$(CACHE) demos/todo-demo-server client -- npx tsc -p demos/todo-demo/tsconfig.server.json --noEmit
compile-hypermedia-demo:
	$(CACHE) demos/hypermedia-demo client client-solid hypermedia -- npx tsc -p demos/hypermedia-demo/tsconfig.json --noEmit
	$(CACHE) demos/hypermedia-demo-server client hypermedia -- npx tsc -p demos/hypermedia-demo/tsconfig.server.json --noEmit

clean-cache:
	rm -rf node_modules/.cache/build-hashes node_modules/.cache/compile-hashes node_modules/.cache/docs-hashes

docs-realtime:
	$(DOCS) packages/realtime -- npm run docs -w packages/realtime
docs-schema:
	$(DOCS) packages/schema -- npm run docs -w packages/schema
docs-hypermedia:
	$(DOCS) packages/hypermedia -- npm run docs -w packages/hypermedia
docs-client:
	$(DOCS) packages/client realtime -- npm run docs -w packages/client
docs-client-solid:
	$(DOCS) packages/client-solid client -- npm run docs -w packages/client-solid
docs-hypermedia-client:
	$(DOCS) packages/hypermedia-client client -- npm run docs -w packages/hypermedia-client

docs:
	@rm -f node_modules/.cache/docs-hashes/docs-staged
	make -j docs-realtime docs-schema docs-hypermedia docs-client docs-hypermedia-client docs-client-solid
	@./scripts/docs-stage.sh

build:
	make -j build-realtime build-schema build-hypermedia
	make build-client
	make -j build-client-solid build-hypermedia-client
	make -j build-devtools compile-todo-demo compile-hypermedia-demo

hm-generate:
	$(WITH_HM_SERVER) npm run cqrs-generate -w @cqrs-toolkit/hypermedia-demo

hm-init:
	$(WITH_HM_SERVER) npm run cqrs-init -w @cqrs-toolkit/hypermedia-demo
