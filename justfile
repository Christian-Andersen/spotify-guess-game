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

# lint and build
check:
    npm run lint
    npm run build

# dev mode
run:
    npm run dev
