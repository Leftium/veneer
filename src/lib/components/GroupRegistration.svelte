<script lang="ts">
	import type { GroupRegistrationMatch } from '$lib/group-registration/detect'
	import {
		serialize,
		parse,
		type GroupMember,
		type Role,
	} from '$lib/group-registration/serialization'
	import { REGEX_DANCE_LEADER, REGEX_DANCE_FOLLOW } from '$lib/dance-constants'
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

	const isCheckboxes = $derived(roleField.type === 'CHECKBOXES')

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

	function roleToOption(role: Role): string {
		if (!role) return ''
		if (role === 'leader' || role === 'both') {
			return roleField.options.find((o) => REGEX_DANCE_LEADER.test(o)) ?? ''
		}
		if (role === 'follower') {
			return roleField.options.find((o) => REGEX_DANCE_FOLLOW.test(o)) ?? ''
		}
		return ''
	}

	function roleToOptions(role: Role): string[] {
		const opts: string[] = []
		if (role === 'leader' || role === 'both') {
			const o = roleField.options.find((opt) => REGEX_DANCE_LEADER.test(opt))
			if (o) opts.push(o)
		}
		if (role === 'follower' || role === 'both') {
			const o = roleField.options.find((opt) => REGEX_DANCE_FOLLOW.test(opt))
			if (o) opts.push(o)
		}
		return opts
	}

	// --- Serialization ---

	let serializedGroup = $derived.by(() => {
		const groupMembers: GroupMember[] = additionalMembers.map((m) => ({
			name: m.name,
			role: deriveRole(isCheckboxes ? m.selectedRoles : [m.selectedRole].filter(Boolean)),
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

		// Member 1 role
		const member1StoreValue = isCheckboxes ? member1RoleGroup.join(', ') : member1Role
		storedValues.byId[roleField.id] = member1StoreValue
		storedValues.byTitle[normalizeTitle(roleField.title)] = member1StoreValue

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
		const checkboxMode = roleField.type === 'CHECKBOXES'

		// Restore member 1 name
		const storedName =
			storedValues.byId[nameField.id] || storedValues.byTitle[normalizeTitle(nameField.title)]
		if (storedName) {
			member1Name = storedName
		}

		// Restore member 1 role
		const storedRole =
			storedValues.byId[roleField.id] || storedValues.byTitle[normalizeTitle(roleField.title)]
		if (storedRole) {
			if (checkboxMode) {
				member1RoleGroup = storedRole.split(', ').filter(Boolean)
			} else {
				member1Role = storedRole
			}
		}

		// Restore additional members from group field
		const storedGroup =
			storedValues.byId[groupField.id] || storedValues.byTitle[normalizeTitle(groupField.title)]
		if (storedGroup) {
			const parsed = parse(storedGroup)
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
		}
	}

	restoreFromLocalStorage()
</script>

<div class="group-registration" bind:this={containerEl}>
	{#if additionalMembers.length > 0 && !clearing}
		<div class="group-header" transition:slide={{ duration: 300 }}>
			<p class="group-count">Group of {additionalMembers.length + 1}</p>
			<button type="button" class="clear-btn" onclick={clearGroup}>Clear group</button>
		</div>
	{/if}

	<!-- Member 1 (primary registrant) -->
	<fieldset>
		<label for="entry.{nameField.id}" class="name-label">
			{#if additionalMembers.length > 0 && !clearing}
				<span class="member-number">1.</span>
			{/if}
			<span class="required-mark">*</span>
			{nameField.title}
		</label>
		<input
			id="entry.{nameField.id}"
			name="entry.{nameField.id}"
			required
			bind:value={member1Name}
			oninput={handleChange}
		/>

		<!-- svelte-ignore a11y_label_has_associated_control -->
		<label for="">
			<span class="required-mark">*</span>
			{roleField.title}
		</label>
		{#each roleField.options as option (option)}
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
						bind:group={member1Role}
						onchange={handleChange}
					/>
				{/if}
				{option}
			</label>
		{/each}
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
						<span class="member-number">{i + 2}.</span>
						{nameField.title}
						<button
							type="button"
							class="delete-btn"
							onclick={() => removeMember(i)}
							aria-label="Remove member {i + 2}">✕</button
						>
					</label>
					<input
						id="extra-name-{member.key}"
						placeholder="(optional)"
						bind:value={member.name}
						oninput={handleChange}
					/>

					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label for="">{roleField.title}</label>
					{#each roleField.options as option (option)}
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
							{option}
						</label>
					{/each}
				</fieldset>
			{/each}
		</div>
	{/if}

	<!-- Hidden group field for form submission -->
	<textarea hidden id="entry.{groupField.id}" name="entry.{groupField.id}" value={serializedGroup}
	></textarea>

	<!-- Actions -->
	<div class="actions">
		<button type="button" class="outline" onclick={addMember}>+ Add Member</button>
	</div>
</div>

<style lang="scss">
	@use 'open-props-scss' as *;

	.group-registration {
		// Tighter spacing globally: override Pico's generous margins
		:global(input),
		:global(textarea),
		:global(select) {
			margin-bottom: $size-1;
		}
	}

	fieldset {
		padding: $size-2 $size-3;
		margin-bottom: 2px;
		border-radius: $radius-2;
		gap: 0;
	}

	fieldset:nth-child(odd of fieldset) {
		background: var(--pico-card-background-color);
	}

	fieldset:nth-child(even of fieldset) {
		background: var(--pico-card-sectioning-background-color, var(--pico-background-color));
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
		color: var(--pico-muted-color);
		font-size: 85%;
		padding: $size-1 $size-2;
		border-radius: $radius-1;
		transition: color 0.15s;

		&:hover,
		&:focus-visible {
			color: var(--pico-del-color, var(--pico-color));
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
		// Reset Pico button styles
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
	}

	.group-count {
		color: var(--pico-muted-color);
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
</style>
