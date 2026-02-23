<script lang="ts">
	import type { GroupRegistrationMatch } from '$lib/group-registration/detect'
	import {
		serialize,
		parse,
		type GroupMember,
		type Role,
	} from '$lib/group-registration/serialization'
	import { REGEX_DANCE_LEADER, REGEX_DANCE_FOLLOW } from '$lib/dance-constants'
	import type { BilingualQuestion } from '$lib/locale-content'
	import { localeText } from '$lib/locale-content'
	import { getLocale } from '$lib/paraglide/runtime.js'
	import { SvelteSet } from 'svelte/reactivity'
	import { slide } from 'svelte/transition'
	import { flip } from 'svelte/animate'
	import store from 'store'
	import { browser } from '$app/environment'

	interface Props {
		match: GroupRegistrationMatch
	}

	let { match }: Props = $props()

	// Derive sub-fields from match so they stay reactive if match changes
	const nameField = $derived(match.nameField)
	const roleField = $derived(match.roleField)
	const groupField = $derived(match.groupField)

	const locale = $derived(getLocale())

	// Cast to BilingualQuestion for bilingual label/option support
	const bNameField = $derived(nameField as BilingualQuestion)
	const bRoleField = $derived(roleField as BilingualQuestion | undefined)

	import type { BilingualText } from '$lib/locale-content'

	// Per-item bilingual toggles
	let nameTitleToggled = $state(false)
	let roleTitleToggled = $state(false)
	let optionToggles = new SvelteSet<number>()

	// Additional-member bilingual toggles: composite keys "name-{key}" / "option-{key}-{j}"
	let extraToggles = new SvelteSet<string>()

	/** Get the "other" language text from a BilingualText */
	function otherLang(bilingual: BilingualText): string {
		return locale === 'ko' ? bilingual.en : bilingual.ko
	}

	const isCheckboxes = $derived(roleField?.type === 'CHECKBOXES')

	// --- Member 1 state ---
	let member1Name = $state('')
	let member1Role = $state('') // for radio (MULTIPLE_CHOICE)
	let member1RoleGroup: string[] = $state([]) // for checkboxes

	// --- Additional members state ---
	interface AdditionalMember {
		key: number
		name: string
		selectedRole: string // for radio
		selectedRoles: string[] // for checkboxes
	}

	let nextKey = $state(0)
	let additionalMembers: AdditionalMember[] = $state([])

	// --- Role helpers ---

	function deriveRole(selected: string[]): Role {
		if (selected.length === 0) return null
		const hasLeader = selected.some((s) => REGEX_DANCE_LEADER.test(s))
		const hasFollow = selected.some((s) => REGEX_DANCE_FOLLOW.test(s))
		if (hasLeader && hasFollow) return 'both'
		if (hasLeader) return 'leader'
		if (hasFollow) return 'follower'
		return null
	}

	// --- Serialization ---

	let serializedGroup = $derived.by(() => {
		const groupMembers: GroupMember[] = additionalMembers.map((m) => ({
			name: m.name,
			role: roleField
				? deriveRole(isCheckboxes ? m.selectedRoles : [m.selectedRole].filter(Boolean))
				: deriveRole([]),
		}))
		return serialize(groupMembers)
	})

	// --- Actions ---

	let containerEl: HTMLDivElement = undefined!

	/** Dispatch a bubbling event so ancestor layouts (e.g. swiper autoHeight) can react. */
	function notifyHeightChange() {
		// Fire after a microtask so the DOM has updated.
		queueMicrotask(() => {
			containerEl?.dispatchEvent(new CustomEvent('groupresize', { bubbles: true, composed: true }))
		})
	}

	function addMember() {
		additionalMembers.push({
			key: nextKey++,
			name: '',
			selectedRole: '',
			selectedRoles: [],
		})
		notifyHeightChange()
	}

	let removedLast = $state(false)

	function removeMember(index: number) {
		removedLast = index === additionalMembers.length - 1
		additionalMembers.splice(index, 1)
		notifyHeightChange()
	}

	let clearing = $state(false)

	function clearGroup() {
		clearing = true
	}

	function onClearOutroEnd() {
		clearing = false
		additionalMembers.length = 0
		notifyHeightChange()
	}

	/** Slide for individual fieldsets, but instant when removing the last item. */
	function memberSlide(node: Element) {
		if (removedLast) return { duration: 0 }
		return slide(node, { duration: 300 })
	}

	/** Outro for the members wrapper: fade+collapse when clearing, slide-only otherwise. */
	function fadeCollapse(node: Element) {
		const h = node.getBoundingClientRect().height
		const dur = clearing ? 300 : 0
		return {
			duration: dur,
			css: (t: number) => {
				const styles = `overflow: hidden; max-height: ${t * h}px;`
				return clearing ? `opacity: ${t}; ${styles}` : styles
			},
		}
	}

	// --- localStorage helpers ---

	function normalizeTitle(title: string) {
		return title?.trim()?.toLowerCase().replace(/\s+/g, '_')
	}

	function saveToLocalStorage() {
		const storedValues = store.get('storedValues') || { byId: {}, byTitle: {} }

		// Member 1 name
		storedValues.byId[nameField.id] = member1Name
		storedValues.byTitle[normalizeTitle(nameField.title)] = member1Name

		// Member 1 role (only when roleField is defined)
		if (roleField) {
			const member1StoreValue = isCheckboxes ? member1RoleGroup.join(', ') : member1Role
			storedValues.byId[roleField.id] = member1StoreValue
			storedValues.byTitle[normalizeTitle(roleField.title)] = member1StoreValue
		}

		// Group field (serialized additional members)
		storedValues.byId[groupField.id] = serializedGroup
		storedValues.byTitle[normalizeTitle(groupField.title)] = serializedGroup

		store.set('storedValues', storedValues)
	}

	// handleChange is called from DOM event handlers (oninput/onchange)
	function handleChange() {
		saveToLocalStorage()
	}

	// --- Persistence via $effect ---
	// Saves to localStorage whenever any reactive value changes
	// (covers programmatic changes not triggered by DOM events)

	$effect(() => {
		// Read all reactive values to track them as dependencies
		void member1Name
		void member1Role
		void member1RoleGroup
		void serializedGroup

		// saveToLocalStorage only writes to external storage (no state mutation)
		saveToLocalStorage()
	})

	// --- Restore from localStorage on init ---

	function restoreFromLocalStorage() {
		if (!browser) return

		const storedValues = store.get('storedValues') || { byId: {}, byTitle: {} }

		// Restore member 1 name
		const storedName =
			storedValues.byId[nameField.id] || storedValues.byTitle[normalizeTitle(nameField.title)]
		if (storedName) {
			member1Name = storedName
		}

		// Restore member 1 role (only when roleField is defined)
		if (roleField) {
			const checkboxMode = roleField.type === 'CHECKBOXES'
			const storedRole =
				storedValues.byId[roleField.id] || storedValues.byTitle[normalizeTitle(roleField.title)]
			if (storedRole) {
				if (checkboxMode) {
					member1RoleGroup = storedRole.split(', ').filter(Boolean)
				} else {
					member1Role = storedRole
				}
			}
		}

		// Restore additional members from group field
		const storedGroup =
			storedValues.byId[groupField.id] || storedValues.byTitle[normalizeTitle(groupField.title)]
		if (storedGroup) {
			const parsed = parse(storedGroup)

			if (roleField) {
				const checkboxMode = roleField.type === 'CHECKBOXES'
				const opts = roleField.options
				additionalMembers = parsed.map((gm) => {
					const leaderOpt = opts.find((o) => REGEX_DANCE_LEADER.test(o)) ?? ''
					const followOpt = opts.find((o) => REGEX_DANCE_FOLLOW.test(o)) ?? ''

					let selectedRole = ''
					let selectedRoles: string[] = []

					if (checkboxMode) {
						if (gm.role === 'leader' || gm.role === 'both') {
							if (leaderOpt) selectedRoles.push(leaderOpt)
						}
						if (gm.role === 'follower' || gm.role === 'both') {
							if (followOpt) selectedRoles.push(followOpt)
						}
					} else {
						if (gm.role === 'leader' || gm.role === 'both') {
							selectedRole = leaderOpt
						} else if (gm.role === 'follower') {
							selectedRole = followOpt
						}
					}

					return {
						key: nextKey++,
						name: gm.name,
						selectedRole,
						selectedRoles,
					}
				})
			} else {
				// No roleField: restore members with empty role state
				additionalMembers = parsed.map((gm) => ({
					key: nextKey++,
					name: gm.name,
					selectedRole: '',
					selectedRoles: [],
				}))
			}
		}
	}

	restoreFromLocalStorage()
</script>

<div class="group-registration" bind:this={containerEl}>
	{#if additionalMembers.length > 0 && !clearing}
		<div class="group-header" transition:slide={{ duration: 300 }}>
			<p class="group-count">단체 {additionalMembers.length + 1}명</p>
			<button type="button" class="clear-btn" onclick={clearGroup}>단체 취소</button>
		</div>
	{/if}

	<!-- Member 1 (primary registrant) -->
	<fieldset>
		<label for="entry.{nameField.id}" class="name-label">
			<span class="required-mark">*</span>
			{#if additionalMembers.length > 0 && !clearing}
				<span class="member-number">1.</span>
			{/if}
			{localeText(bNameField.bilingualTitle, locale, nameField.title)}
			{#if bNameField.bilingualTitle}<button
					type="button"
					class="lang-toggle"
					class:toggled={nameTitleToggled}
					onclick={(e) => {
						e.stopPropagation()
						nameTitleToggled = !nameTitleToggled
					}}>🌐</button
				><span class="lang-alt">{otherLang(bNameField.bilingualTitle)}</span>{/if}
		</label>
		<input
			id="entry.{nameField.id}"
			name="entry.{nameField.id}"
			required
			bind:value={member1Name}
			oninput={handleChange}
		/>

		{#if roleField}
			<label for="">
				{#if roleField.required}
					<span class="required-mark">*</span>
				{:else}
					<span class="required-mark" aria-hidden="true" style="visibility:hidden">*</span>
				{/if}
				{localeText(bRoleField?.bilingualTitle, locale, roleField.title)}
				{#if bRoleField?.bilingualTitle}<button
						type="button"
						class="lang-toggle"
						class:toggled={roleTitleToggled}
						onclick={(e) => {
							e.stopPropagation()
							roleTitleToggled = !roleTitleToggled
						}}>🌐</button
					><span class="lang-alt">{otherLang(bRoleField.bilingualTitle)}</span>{/if}
			</label>
			{#each roleField.options as option, i (option)}
				<label>
					{#if isCheckboxes}
						<input
							type="checkbox"
							name="entry.{roleField.id}"
							value={option}
							bind:group={member1RoleGroup}
							onchange={handleChange}
						/>
					{:else}
						<input
							type="radio"
							name="entry.{roleField.id}"
							value={option}
							required={roleField.required}
							bind:group={member1Role}
							onchange={handleChange}
						/>
					{/if}
					{localeText(
						bRoleField?.bilingualOptions?.[i],
						locale,
						option,
					)}{#if bRoleField?.bilingualOptions?.[i]}<button
							type="button"
							class="lang-toggle"
							class:toggled={optionToggles.has(i)}
							onclick={(e) => {
								e.stopPropagation()
								optionToggles.has(i) ? optionToggles.delete(i) : optionToggles.add(i)
							}}>🌐</button
						><span class="lang-alt">{otherLang(bRoleField.bilingualOptions![i]!)}</span>{/if}
				</label>
			{/each}
			{#if isCheckboxes && roleField.required}
				<input
					type="checkbox"
					style="opacity:0; position:absolute; margin-top:-1.5em; pointer-events:none"
					tabindex="-1"
					required={browser && member1RoleGroup.length === 0}
					disabled={!browser || member1RoleGroup.length > 0}
				/>
			{/if}
		{/if}
	</fieldset>

	<!-- Additional members (2+) -->
	{#if additionalMembers.length > 0 && !clearing}
		<div
			class="members-group"
			in:slide={{ duration: 300 }}
			out:fadeCollapse
			onoutroend={onClearOutroEnd}
		>
			{#each additionalMembers as member, i (member.key)}
				<fieldset
					in:slide|local={{ duration: 300 }}
					out:memberSlide|local
					animate:flip={{ duration: 300 }}
				>
					<label for="extra-name-{member.key}" class="name-label">
						<span class="required-mark" aria-hidden="true" style="visibility:hidden">*</span>
						<span class="member-number">{i + 2}.</span>
						{localeText(
							bNameField.bilingualTitle,
							locale,
							nameField.title,
						)}{#if bNameField.bilingualTitle}<button
								type="button"
								class="lang-toggle"
								class:toggled={extraToggles.has(`name-${member.key}`)}
								onclick={(e) => {
									e.stopPropagation()
									const k = `name-${member.key}`
									extraToggles.has(k) ? extraToggles.delete(k) : extraToggles.add(k)
								}}>🌐</button
							><span class="lang-alt">{otherLang(bNameField.bilingualTitle)}</span>{/if}
						<button
							type="button"
							class="delete-btn"
							onclick={() => removeMember(i)}
							aria-label="신청자 {i + 2} 삭제">✕</button
						>
					</label>
					<input
						id="extra-name-{member.key}"
						placeholder="(선택)"
						bind:value={member.name}
						oninput={handleChange}
					/>

					{#if roleField}
						<label for=""
							><span class="required-mark" aria-hidden="true" style="visibility:hidden">*</span>
							{localeText(
								bRoleField?.bilingualTitle,
								locale,
								roleField.title,
							)}{#if bRoleField?.bilingualTitle}<button
									type="button"
									class="lang-toggle"
									class:toggled={extraToggles.has(`role-${member.key}`)}
									onclick={(e) => {
										e.stopPropagation()
										const k = `role-${member.key}`
										extraToggles.has(k) ? extraToggles.delete(k) : extraToggles.add(k)
									}}>🌐</button
								><span class="lang-alt">{otherLang(bRoleField.bilingualTitle)}</span>{/if}</label
						>
						{#each roleField.options as option, j (option)}
							<label>
								{#if isCheckboxes}
									<input
										type="checkbox"
										name="extra-role-{member.key}"
										value={option}
										bind:group={member.selectedRoles}
										onchange={handleChange}
									/>
								{:else}
									<input
										type="radio"
										name="extra-role-{member.key}"
										value={option}
										bind:group={member.selectedRole}
										onchange={handleChange}
									/>
								{/if}
								{localeText(
									bRoleField?.bilingualOptions?.[j],
									locale,
									option,
								)}{#if bRoleField?.bilingualOptions?.[j]}<button
										type="button"
										class="lang-toggle"
										class:toggled={extraToggles.has(`option-${member.key}-${j}`)}
										onclick={(e) => {
											e.stopPropagation()
											const k = `option-${member.key}-${j}`
											extraToggles.has(k) ? extraToggles.delete(k) : extraToggles.add(k)
										}}>🌐</button
									><span class="lang-alt">{otherLang(bRoleField.bilingualOptions![j]!)}</span>{/if}
							</label>
						{/each}
					{/if}
				</fieldset>
			{/each}
		</div>
	{/if}

	<!-- Hidden group field for form submission -->
	<textarea hidden id="entry.{groupField.id}" name="entry.{groupField.id}" value={serializedGroup}
	></textarea>

	<!-- Actions -->
	<div class="actions">
		<button type="button" class="outline" onclick={addMember}>+ 신청자 추가</button>
	</div>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	.group-registration {
		margin-top: 0;
		margin-bottom: 0;

		// Tighter spacing globally: override Pico's generous margins
		:global(input),
		:global(textarea),
		:global(select) {
			margin-bottom: $size-1;
		}
	}

	fieldset {
		padding: $size-2 $size-3;
		padding-inline: 0;
		margin-bottom: 0;
		gap: 0;
	}

	.members-group {
		margin-top: $size-2;
	}

	// Left border accent — pulled into parent padding so inputs align with non-grouped fields.
	// Global forms.scss sets fieldset { width: 100% }, so negative margin shifts the box
	// without growing it. We override width to compensate.
	// Net content shift: -margin + border + padding = 0.
	.group-registration > fieldset,
	.members-group fieldset {
		border-left: 3px solid var(--app-border-color);
		margin-left: calc(-1 * ($size-2 + 3px));
		padding-left: $size-2;
		width: calc(100% + $size-2 + 3px);
		margin-bottom: $size-2;
	}

	.members-group fieldset:last-child {
		margin-bottom: 0;
	}

	.group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: $size-3;
		margin-bottom: 0;
	}

	.clear-btn {
		all: unset;
		cursor: pointer;
		color: var(--app-muted-color);
		font-size: 85%;
		padding: $size-1 $size-2;
		border-radius: $radius-1;
		transition: color 0.15s;

		&:hover,
		&:focus-visible {
			color: var(--app-del-color, var(--app-color));
		}
	}

	.name-label {
		display: flex;
		align-items: center;
		gap: $size-1;
	}

	.member-number {
		font-weight: bold;
		font-size: 110%;
	}

	.delete-btn {
		all: unset;
		cursor: pointer;
		margin-left: auto;
		opacity: 0.4;
		font-size: 120%;
		padding: $size-1;
		line-height: 1;
		border-radius: $radius-1;
		transition: opacity 0.15s;

		&:hover,
		&:focus-visible {
			opacity: 1;
		}
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: $size-3;
		flex-wrap: wrap;
		margin-bottom: 0;

		button {
			margin-bottom: 0;
		}
	}

	.group-count {
		color: var(--app-muted-color);
		margin: 0;
		font-weight: 600;
	}

	.required-mark {
		color: $red-7;
	}

	// Tighter label spacing within fieldsets
	fieldset label[for] {
		margin-top: $size-1;
		margin-bottom: 0;
		font-weight: bold;
	}

	fieldset label[for]:first-of-type {
		margin-top: 0;
	}

	// Checkbox/radio option labels — minimal gap
	fieldset label:has(input[type='checkbox']),
	fieldset label:has(input[type='radio']) {
		margin-bottom: 0;
	}

	// Remove bottom margin from last element in fieldset to avoid double-spacing
	fieldset > :last-child {
		margin-bottom: 0;
	}

	.lang-toggle {
		all: unset;
		display: inline;
		cursor: pointer;
		font-size: 0.7em;
		vertical-align: middle;
		opacity: 0.5;
		margin-left: 0.3em;
		transition: opacity 0.15s;
		user-select: none;
		filter: grayscale(1);

		&:hover,
		&:focus-visible {
			opacity: 1;
		}
	}

	.lang-alt {
		display: none;
		opacity: 0.6;
		font-style: italic;
		font-weight: normal;
		font-size: 0.85em;
		margin-left: 0;
	}

	.lang-toggle:hover + .lang-alt,
	.lang-toggle.toggled + .lang-alt {
		display: inline;
	}
</style>
