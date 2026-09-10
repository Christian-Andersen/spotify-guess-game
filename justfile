alias c := check
alias r := run

[private]
default:
    @just --list

check:
    npm run lint
    npm run build

run:
    npm run dev
