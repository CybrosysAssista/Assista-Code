"use client"

import { useTheme } from "next-themes"

export function useLogoSrc(): string {
	const { resolvedTheme } = useTheme()
	return resolvedTheme === "light" ? "/Cybrosys-Assista-Logo-Horiz-blk.svg" : "/Cybrosys-Assista-Logo-Horiz-white.svg"
}
