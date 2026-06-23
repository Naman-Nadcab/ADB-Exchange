# Batch findings: wallet-1

**Label:** Wallet — core user routes  
**Ran:** 2026-06-23T02:43:47.903Z  
**Status:** stopped-timeout  
**Routes tested:** 3/13

> **Stopped at timeout:** `/wallet/deposit` (frontend)


## Summary

| Route | Status | Btn OK | Btn Fail | Forms | Modals | Dropdowns | Tabs | Issues |
|-------|--------|--------|----------|-------|--------|-----------|------|--------|
| /wallet | OK | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /wallet/deposit/crypto | OK | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /wallet/deposit | TIMEOUT | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

## Button failures

_None_

## Issues

| Route | Sev | Type | Message |
| --- | --- | --- | --- |
| /wallet/deposit | P1 | timeout | page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/wallet/deposit", waiting until "domcontentloaded"


## Console / network (sample)

_Clean_
