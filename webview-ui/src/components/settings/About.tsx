
import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import { Info, Download, Upload, TriangleAlert } from "lucide-react"

import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { Package } from "@assista/package"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"


export const About = ({ className, ...props }: { className?: string } & HTMLAttributes<HTMLDivElement>) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader
				description={
					Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`
				}>
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<Trans
						i18nKey="settings:footer.feedback"
						components={{
							githubLink: <VSCodeLink href="https://github.com/CybrosysAssistaInc/Cybrosys-Assista" />,
							redditLink: <VSCodeLink href="https://reddit.com/r/CybrosysAssista" />,
							discordLink: <VSCodeLink href="https://discord.gg/cybrosysassista" />,
						}}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2 mt-2">
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						className="w-28">
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.settings.reset")}
					</Button>
				</div>
			</Section>
		</div>
	)
}
