SHELL := bash
ROOT := $(CURDIR)
SDK := $(ROOT)/sdk
PTAU ?= $(ROOT)/powersOfTau28_hez_final_14.ptau
CONTRACT_ID ?= $(shell grep '^ENCRYPTED_TOKEN_CONTRACT_ID=' $(ROOT)/.env | cut -d= -f2)
NODE_TLS ?= 0

ifeq ($(NODE_TLS),0)
  NODE_ENV_FLAGS := NODE_TLS_REJECT_UNAUTHORIZED=0
else
  NODE_ENV_FLAGS :=
endif

export $(NODE_ENV_FLAGS)

.PHONY: help install-sdk circuits circuits-phase2 circuits-clean \
        build-contracts test-contracts deploy upload-vks upload-vk-transfer \
        proof-register proof-register-receptor proof-transfer check-register check-receptor

help:
	@echo "Encrypted Stellar — common targets"
	@echo ""
	@echo "  make install-sdk          npm install in sdk/"
	@echo "  make circuits             compile Circom (no zkey)"
	@echo "  make circuits-phase2      compile + Groth16 setup (needs PTAU=...)"
	@echo "  make build-contracts      release WASM + stellar optimize"
	@echo "  make test-contracts       cargo test encrypted_token"
	@echo "  make deploy               deploy verifier + token + Register VK"
	@echo "  make upload-vks           upload all VKs to token contract"
	@echo "  make upload-vk-transfer   upload Transfer VK only"
	@echo "  make proof-register       register owner (+ saves circuits/build/register/state.json)"
	@echo "  make proof-register-receptor  register TEST_RECEPTOR (needs RECEPTOR_SECRET_KEY)"
	@echo "  make proof-transfer       private transfer owner -> TEST_RECEPTOR_ADDRESS"
	@echo "  make check-register       simulate is_registered for owner"
	@echo "  make check-receptor       simulate is_registered for TEST_RECEPTOR_ADDRESS"

install-sdk:
	cd $(SDK) && npm install

circuits:
	bash scripts/build-circuits.sh

circuits-phase2:
	bash -c 'PHASE2=true PTAU="$(PTAU)" bash scripts/build-circuits.sh'

circuits-clean:
	rm -rf circuits/build

build-contracts:
	cargo build --target wasm32v1-none --release -p groth16_verifier -p encrypted_token
	stellar contract optimize --wasm target/wasm32v1-none/release/groth16_verifier.wasm \
		--wasm-out target/wasm32v1-none/release/groth16_verifier.optimized.wasm
	stellar contract optimize --wasm target/wasm32v1-none/release/encrypted_token.wasm \
		--wasm-out target/wasm32v1-none/release/encrypted_token.optimized.wasm

test-contracts:
	cargo test -p encrypted_token

deploy:
	cd $(SDK) && npm run deploy:native-bn254

upload-vks:
	cd $(SDK) && npm run upload:vks

upload-vk-transfer:
	cd $(SDK) && npm run upload:vks:transfer

proof-register:
	cd $(SDK) && npm run proof:register

proof-register-receptor:
	cd $(SDK) && npm run proof:register-receptor

proof-transfer:
	cd $(SDK) && npm run proof:transfer

check-register:
	cd $(SDK) && npx tsx scripts/check-registration.ts owner

check-receptor:
	cd $(SDK) && npx tsx scripts/check-registration.ts receptor
