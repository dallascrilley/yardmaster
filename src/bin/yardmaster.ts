#!/usr/bin/env node

import { cli } from '../cli.js'

await cli(process.argv.slice(2))
