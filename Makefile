CACHE = ./scripts/cache-run.sh
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

clean-cache:
	rm -rf node_modules/.cache/build-hashes

docs:
	npm run docs --workspaces --if-present

build:
	make -j build-realtime build-schema build-hypermedia build-hypermedia-client
	make build-client
	make build-client-solid
	make build-devtools
	make docs

hm-generate:
	$(WITH_HM_SERVER) npm run cqrs-generate -w @cqrs-toolkit/hypermedia-demo

hm-init:
	$(WITH_HM_SERVER) npm run cqrs-init -w @cqrs-toolkit/hypermedia-demo
