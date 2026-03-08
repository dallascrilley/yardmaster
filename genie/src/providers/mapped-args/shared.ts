function pushRepeatable(args: string[], flag: string, values: string[]) {
  for (const value of values) {
    args.push(flag, value)
  }
}

export { pushRepeatable }
