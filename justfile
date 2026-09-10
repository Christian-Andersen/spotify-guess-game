alias c := check
alias r := run

[private]
default:
    @just --list

check:
    pass

run:
    npm run dev
