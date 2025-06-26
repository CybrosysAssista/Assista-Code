import { useState } from "react"
import { useMount } from "react-use"

export const useAssistaPortal = (id: string) => {
	const [container, setContainer] = useState<HTMLElement>()

	useMount(() => setContainer(document.getElementById(id) ?? undefined))

	return container
}
