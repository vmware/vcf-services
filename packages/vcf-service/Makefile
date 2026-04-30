include version.mk

.SHELLFLAGS := -ec

REGISTRY_SOCKET ?= 127.0.0.1:5000
REGISTRY_CLIENT_TLS_OPTIONS ?= --registry-verify-certs=false --registry-insecure=true

BUNDLE_DIR := bundle

DIST                       := dist
DIST_BUNDLE_DIR            := $(DIST)/vcf-service
DIST_PACKAGE_FILE          := $(DIST_BUNDLE_DIR)/package.yml
DIST_VALUES_FILE           := $(DIST_BUNDLE_DIR)/.values/render.yml
DIST_BUNDLE_REPO           := $(REGISTRY_SOCKET)/$(COMPONENT_NAME)/$(VERSION)/vcf-service-$(NAME):$(VERSION_TAG)
DIST_BUNDLE_TAR            := $(DIST)/$(BASE_NAME)-$(VERSION_TAG).tar
DIST_PACKAGE_YML           := $(DIST)/$(BASE_NAME)-$(VERSION_TAG).yml
DIST_DEPENDENCIES_DIR      := $(DIST_BUNDLE_DIR)/config/.vcf
DIST_DEPENDENCIES_FILE     := $(DIST_BUNDLE_DIR)/config/.vcf/dependencies.yml
DIST_INSTALL_UI_PLUGINS_DIR  := $(DIST_BUNDLE_DIR)/.install
DIST_INSTALL_UI_PLUGINS_FILE := $(DIST_INSTALL_UI_PLUGINS_DIR)/dependencies.yml

COMPONENT_DIR_WITH_TAG := $(COMPONENT_NAME)/ga/$(VERSION_WITHOUT_BUILD_NUMBER)/$(BASE_NAME):$(VERSION)

.PHONY: all build build-images-yml build-package-yml setup \
        with-ui-plugins with-install-ui-plugins validate render-templates test clean help

all: build

# --------------------------------------------------------------------------
# Prerequisites check
# --------------------------------------------------------------------------
check-tools:
	@command -v ytt    >/dev/null 2>&1 || { echo "Error: ytt is not installed.  See https://carvel.dev/ytt/";    exit 1; }
	@command -v kbld   >/dev/null 2>&1 || { echo "Error: kbld is not installed.  See https://carvel.dev/kbld/";  exit 1; }
	@command -v imgpkg >/dev/null 2>&1 || { echo "Error: imgpkg is not installed. See https://carvel.dev/imgpkg/"; exit 1; }
	@command -v yq     >/dev/null 2>&1 || { echo "Error: yq is not installed.   See https://github.com/mikefarah/yq"; exit 1; }

# --------------------------------------------------------------------------
# Build — full pipeline (mirrors upstream services/Makefile)
# --------------------------------------------------------------------------
build: check-tools build-images-yml
	@echo "==> Pushing bundle to local registry..."
	imgpkg push \
		-b $(DIST_BUNDLE_REPO) \
		-f $(DIST_BUNDLE_DIR) \
		$(REGISTRY_CLIENT_TLS_OPTIONS)

	@echo "==> Exporting bundle to tar..."
	imgpkg copy \
		--bundle "$(DIST_BUNDLE_REPO)" \
		--to-tar "$(DIST_BUNDLE_TAR)" \
		$(REGISTRY_CLIENT_TLS_OPTIONS)

	@echo ""
	@echo "Build complete:"
	@echo "  tar : $(DIST_BUNDLE_TAR)"
	@echo "  yml : $(DIST_PACKAGE_YML)"

# --------------------------------------------------------------------------
# Generate .imgpkg/images.yml via kbld
# --------------------------------------------------------------------------
build-images-yml: build-package-yml
	@echo "==> Generating image lock file..."
	mkdir -p $(DIST_BUNDLE_DIR)/.imgpkg

	ytt \
		--ignore-unknown-comments \
		--data-values-file $(DIST_VALUES_FILE) \
		-f $(DIST_BUNDLE_DIR)/config \
		$(if $(wildcard $(DIST_INSTALL_UI_PLUGINS_DIR)),-f $(DIST_INSTALL_UI_PLUGINS_DIR)) \
		> $(DIST_BUNDLE_DIR).yml

	kbld \
		-f $(DIST_BUNDLE_DIR).yml \
		--imgpkg-lock-output $(DIST_BUNDLE_DIR)/.imgpkg/images.yml \
		$(REGISTRY_CLIENT_TLS_OPTIONS)

# --------------------------------------------------------------------------
# Generate versioned package.yml
# --------------------------------------------------------------------------
build-package-yml: \
	setup \
	$(if $(UI_PLUGINS),with-ui-plugins) \
	$(if $(INSTALL_UI_PLUGINS),with-install-ui-plugins)

	@echo "==> Generating versioned package.yml..."
	cat $(BUNDLE_DIR)/package.yml | \
	yq 'select(.kind == "PackageMetadata") | .metadata.name = "$(NAME).$(VERSION)"' \
	> $(DIST_PACKAGE_FILE)

	echo "---" >> $(DIST_PACKAGE_FILE)

	cat $(BUNDLE_DIR)/package.yml | \
	yq 'select(.kind == "Package") | .metadata.name = "$(NAME).$(VERSION)"' | \
	yq 'select(.kind == "Package") | .spec.refName = "$(NAME)"' | \
	yq 'select(.kind == "Package") | .spec.version = "$(VERSION)"' | \
	yq 'select(.kind == "Package") | .spec.template.spec.fetch[0].imgpkgBundle.image = null' \
	>> $(DIST_PACKAGE_FILE)

	cat $(DIST_PACKAGE_FILE) | \
	yq 'select(.kind == "Package") | .spec.template.spec.fetch[0].imgpkgBundle.image = "depot.kube-system.svc/vcf/$(COMPONENT_DIR_WITH_TAG)"' \
	>> $(DIST_PACKAGE_YML)

# --------------------------------------------------------------------------
# Setup — copy bundle to dist
# --------------------------------------------------------------------------
setup:
	mkdir -p $(DIST_BUNDLE_DIR)
	cp -a $(BUNDLE_DIR)/. $(DIST_BUNDLE_DIR)/

	mkdir -p $(DIST_DEPENDENCIES_DIR)
	echo "#@data/values" > $(DIST_DEPENDENCIES_FILE)
	echo "---" >> $(DIST_DEPENDENCIES_FILE)

# --------------------------------------------------------------------------
# Push UI plugins (config/) to local registry and write dependencies
# --------------------------------------------------------------------------
with-ui-plugins: setup
	@echo "==> Pushing UI plugins..."
	@yq -i 'del(.__system)' $(DIST_VALUES_FILE) 2>/dev/null || true
	@$(foreach pair,$(UI_PLUGINS), \
		yq -i '.__system.$(word 1,$(subst =, ,$(pair))) = "$(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair)))"' $(DIST_DEPENDENCIES_FILE) ; \
	)
	@$(foreach pair,$(UI_PLUGINS), \
		echo "    Pushing $(word 2,$(subst =, ,$(pair))) -> $(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair)))" ; \
		imgpkg push \
			-f $(word 2,$(subst =, ,$(pair))) \
			-i $(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair))) \
			$(REGISTRY_CLIENT_TLS_OPTIONS) ; \
	)

# --------------------------------------------------------------------------
# Push install UI plugins (.install/) to local registry and write dependencies
# --------------------------------------------------------------------------
with-install-ui-plugins: setup
	@echo "==> Pushing install UI plugins..."
	mkdir -p $(DIST_DEPENDENCIES_DIR)
	echo "#@data/values" > $(DIST_INSTALL_UI_PLUGINS_FILE)
	echo "#@overlay/match-child-defaults missing_ok=True" >> $(DIST_INSTALL_UI_PLUGINS_FILE)
	echo "---" >> $(DIST_INSTALL_UI_PLUGINS_FILE)
	@$(foreach pair,$(INSTALL_UI_PLUGINS), \
		yq -i '.__systemInstall.$(word 1,$(subst =, ,$(pair))) = "$(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair)))"' $(DIST_INSTALL_UI_PLUGINS_FILE) ; \
	)
	@$(foreach pair,$(INSTALL_UI_PLUGINS), \
		echo "    Pushing $(word 2,$(subst =, ,$(pair))) -> $(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair)))" ; \
		imgpkg push \
			-f $(word 2,$(subst =, ,$(pair))) \
			-i $(REGISTRY_SOCKET)/$(word 3,$(subst =, ,$(pair))) \
			$(REGISTRY_CLIENT_TLS_OPTIONS) ; \
	)

# --------------------------------------------------------------------------
# Validate — render templates with sample values (no registry needed)
# --------------------------------------------------------------------------
validate:
	@command -v ytt >/dev/null 2>&1 || { echo "Error: ytt is not installed. See https://carvel.dev/ytt/"; exit 1; }
	@echo "==> Validating ytt templates..."
	@ytt -f $(BUNDLE_DIR)/config --data-values-file $(BUNDLE_DIR)/.values/render.yml > /dev/null
	@echo "    Templates are valid."

# --------------------------------------------------------------------------
# Render templates — produce rendered YAML for inspection (no registry)
# --------------------------------------------------------------------------
render-templates:
	@command -v ytt >/dev/null 2>&1 || { echo "Error: ytt is not installed. See https://carvel.dev/ytt/"; exit 1; }
	@echo "==> Rendering templates..."
	@mkdir -p $(DIST)
	@ytt -f $(BUNDLE_DIR)/config --data-values-file $(BUNDLE_DIR)/.values/render.yml > $(DIST)/rendered.yml
	@echo "    Output: $(DIST)/rendered.yml"

# --------------------------------------------------------------------------
# Test — run unit tests (only ytt needed)
# --------------------------------------------------------------------------
test:
	@command -v ytt >/dev/null 2>&1 || { echo "Error: ytt is not installed. See https://carvel.dev/ytt/"; exit 1; }
	@echo "==> Running unit tests..."
	@bash unit-tests/run.sh

# --------------------------------------------------------------------------
# Clean
# --------------------------------------------------------------------------
clean:
	@echo "==> Cleaning dist/..."
	@rm -rf $(DIST)

# --------------------------------------------------------------------------
# Help
# --------------------------------------------------------------------------
help:
	@echo "VCF Service Build Targets:"
	@echo ""
	@echo "  make build              Full build pipeline (requires local registry + Carvel tools)"
	@echo "  make validate           Validate ytt templates render without errors"
	@echo "  make render-templates   Render templates to dist/rendered.yml for inspection"
	@echo "  make test               Run unit tests"
	@echo "  make clean              Remove dist/ directory"
	@echo ""
	@echo "Environment variables:"
	@echo "  VCFA_CUSTOMER_VERSION   e.g. 9.1.0   (default: 0.1.0)"
	@echo "  VCFA_CUSTOMER_PATCH     e.g. 0       (default: 0)"
	@echo "  BUILD_NUMBER            e.g. 12345    (default: 0)"
	@echo "  REGISTRY_SOCKET         e.g. 127.0.0.1:5000 (default: 127.0.0.1:5000)"
	@echo "  VCFA_PLUGIN_DIR         Path to vcfa-plugin (default: ../vcfa-plugin)"
	@echo ""
	@echo "UI Plugin:"
	@echo "  The build bundles $(VCFA_PLUGIN_DIR)/dist/plugin.zip as an install UI plugin."
	@echo "  Build the plugin first:  cd $(VCFA_PLUGIN_DIR) && npm run build:plugin"
	@echo ""
	@echo "Prerequisites for full build:"
	@echo "  1. Local OCI registry running at REGISTRY_SOCKET"
	@echo "     docker run -d -p 5000:5000 --name registry registry:2"
	@echo "  2. Carvel tools: ytt, kbld, imgpkg"
	@echo "     brew install ytt kbld imgpkg"
	@echo "  3. yq: brew install yq"
