set dotenv-load

alias b := build
alias c := check
alias r := run

[private]
default:
    @just --list

[private]
ensure-setup:
    @test -d node_modules || just setup

# install all required tools and dependencies
setup:
    @echo "Installing dependencies..."
    npm install

audit:
    npm audit

check:
    prek run --all-files

build:
    npm run build

run:
    npm run dev

ci: setup audit check build
