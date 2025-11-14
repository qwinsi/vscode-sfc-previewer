/*
 * This a copy of "svelte/internal/flags/legacy.js"
 */
export let legacy_mode_flag = false;

function enable_legacy_mode_flag() {
	legacy_mode_flag = true;
}

enable_legacy_mode_flag();
