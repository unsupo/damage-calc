$.fn.DataTable.ColVis.prototype._fnDomColumnButton = function (i) {
	const that = this,
		column = this.s.dt.aoColumns[i],
		dt = this.s.dt;

	const title = this.s.fnLabel === null ?
		column.sTitle :
		this.s.fnLabel(i, column.sTitle, column.nTh);

	return $(
		'<li ' + (dt.bJUI ? 'class="ui-button ui-state-default"' : '') + '>' +
		'<label>' +
		'<input type="checkbox" />' +
		'<span>' + title + '</span>' +
		'</label>' +
		'</li>'
	)
		.click(function (e) {
			let showHide = !$('input', this).is(":checked");
			if (e.target.nodeName.toLowerCase() !== "li") {
				showHide = !showHide;
			}

			/* Need to consider the case where the initialiser created more than one table - change the
			 * API index that DataTables is using
			 */
			const oldIndex = $.fn.dataTableExt.iApiIndex;
			$.fn.dataTableExt.iApiIndex = that._fnDataTablesApiIndex();

			// Optimisation for server-side processing when scrolling - don't do a full redraw
			if (dt.oFeatures.bServerSide) {
				that.s.dt.oInstance.fnSetColumnVis(i, showHide, false);
				that.s.dt.oInstance.fnAdjustColumnSizing(false);
				if (dt.oScroll.sX !== "" || dt.oScroll.sY !== "") {
					that.s.dt.oInstance.oApi._fnScrollDraw(that.s.dt);
				}
				that._fnDrawCallback();
			} else {
				that.s.dt.oInstance.fnSetColumnVis(i, showHide);
			}

			$.fn.dataTableExt.iApiIndex = oldIndex; /* Restore */

			if ((e.target.nodeName.toLowerCase() === 'input' || e.target.nodeName.toLowerCase() === 'li') && that.s.fnStateChange !== null) {
				that.s.fnStateChange.call(that, i, showHide);
			}
		})[0];
};

$.fn.dataTableExt.oSort['damage100-asc'] = function (a, b) {
	return parseFloat(a) - parseFloat(b);
};
$.fn.dataTableExt.oSort['damage100-desc'] = function (a, b) {
	return parseFloat(b) - parseFloat(a);
};

$.fn.dataTableExt.oSort['damage48-asc'] = function (a, b) {
	return parseInt(a) - parseInt(b);
};
$.fn.dataTableExt.oSort['damage48-desc'] = function (a, b) {
	return parseInt(b) - parseInt(a);
};

let table;

function performCalculations() {
	let attacker, defender, setName, setTier;
	const selectedTiers = getSelectedTiers();
	const setOptions = getSetOptions();
	const dataSet = [];
	const pokeInfo = $("#p1");
	for (let i = 0; i < setOptions.length; i++) {
		if (setOptions[i].id && typeof setOptions[i].id !== "undefined") {
			setName = setOptions[i].id.substring(setOptions[i].id.indexOf("(") + 1, setOptions[i].id.lastIndexOf(")"));
			setTier = setName.substring(0, setName.indexOf(" "));
			if (selectedTiers.indexOf(setTier) !== -1) {
				const field = createField();
				if (mode === "one-vs-all") {
					attacker = createPokemon(parsePokeInfo(pokeInfo));
					defender = createPokemon(parsePokeInfo(setOptions[i].id));
				} else {
					attacker = createPokemon(parsePokeInfo(setOptions[i].id));
					defender = createPokemon(parsePokeInfo(pokeInfo));
					field.swap();
				}
				if (attacker.ability === "Rivalry") {
					attacker.gender = "N";
				}
				if (defender.ability === "Rivalry") {
					defender.gender = "N";
				}
				const damageResults = calculateMovesOfAttacker(gen, attacker, defender, field);
				attacker = damageResults[0].attacker;
				defender = damageResults[0].defender;
				let result, minMaxDamage, minDamage, maxDamage, minPercentage, maxPercentage, minPixels, maxPixels;
				let highestDamage = -1;
				const data = [setOptions[i].id];
				for (let n = 0; n < 4; n++) {
					result = damageResults[n];
					minMaxDamage = result.range();
					minDamage = minMaxDamage[0] * attacker.moves[n].hits;
					maxDamage = minMaxDamage[1] * attacker.moves[n].hits;
					minPercentage = Math.floor(minDamage * 1000 / defender.maxHP()) / 10;
					maxPercentage = Math.floor(maxDamage * 1000 / defender.maxHP()) / 10;
					minPixels = Math.floor(minDamage * 48 / defender.maxHP());
					maxPixels = Math.floor(maxDamage * 48 / defender.maxHP());
					if (maxDamage > highestDamage) {
						highestDamage = maxDamage;
						while (data.length > 1) {
							data.pop();
						}
						data.push(attacker.moves[n].name.replace("Hidden Power", "HP"));
						data.push(minPercentage + " - " + maxPercentage + "%");
						data.push(minPixels + " - " + maxPixels + "px");
						data.push(attacker.moves[n].bp === 0 ? 'nice move' : (result.kochance(false).text || 'possibly the worst move ever'));
					}
				}
				data.push((mode === "one-vs-all") ? defender.types[0] : attacker.types[0]);
				data.push(((mode === "one-vs-all") ? defender.types[1] : attacker.types[1]) || "");
				data.push(((mode === "one-vs-all") ? defender.ability : attacker.ability) || "");
				data.push(((mode === "one-vs-all") ? defender.item : attacker.item) || "");
				dataSet.push(data);
			}
		}
	}
	const pokemon = mode === "one-vs-all" ? attacker : defender;
	if (pokemon) pokeInfo.find(".sp .totalMod").text(pokemon.stats.spe);
	table.rows.add(dataSet).draw();
}

function getSelectedTiers() {
	return $('.tiers input:checked').map(function () {
		return this.id;
	}).get();
}

function calculateMovesOfAttacker(gen, attacker, defender, field) {
	const results = [];
	for (let i = 0; i < 4; i++) {
		results[i] = calc.calculate(gen, attacker, defender, attacker.moves[i], field);
	}
	return results;
}

$(".gen").change(function () {
	$(".tiers input").prop("checked", false);
	$("#singles-format").attr("disabled", false);
	adjustTierBorderRadius();

	if ($.fn.DataTable.isDataTable("#holder-2")) {
		table.clear();
		constructDataTable();
		placeBsBtn();
	}
});

function adjustTierBorderRadius() {
	const squaredLeftCorner = {"border-top-left-radius": 0, "border-bottom-left-radius": 0};
	const roundedLeftCorner = {"border-top-left-radius": "8px", "border-bottom-left-radius": "8px"};
	if (gen <= 2) {
		$("#UU").next("label").css(roundedLeftCorner);
	} else {
		$("#UU").next("label").css(squaredLeftCorner);
		$("#NU").next("label").css(roundedLeftCorner);

		if (gen > 3) {
			$("#NU").next("label").css(squaredLeftCorner);
			$("#LC").next("label").css(roundedLeftCorner);

			if (gen > 4) {
				$("#LC").next("label").css(squaredLeftCorner);
				$("#Doubles").next("label").css(roundedLeftCorner);

				if (gen > 5) {
					$("#Doubles").next("label").css(squaredLeftCorner);
				}
			}
		}
	}
}

function constructDataTable() {
	table = $("#holder-2").DataTable({
		destroy: true,
		columnDefs: [
			{
				targets: [3, 5, 6, 7, 8],
				visible: false,
				searchable: false
			},
			{
				targets: [2],
				type: 'damage100'
			},
			{
				targets: [3],
				type: 'damage48'
			},
			{targets: [4],
				iDataSort: 2
			}
		],
		dom: 'C<"clear">fti',
		colVis: {
			exclude: (gen > 2) ? [0, 1, 2] : (gen === 2) ? [0, 1, 2, 7] : [0, 1, 2, 7, 8],
			stateChange: function (iColumn, bVisible) {
				const column = table.settings()[0].aoColumns[iColumn];
				if (column.bSearchable !== bVisible) {
					column.bSearchable = bVisible;
					table.rows().invalidate();
				}
			}
		},
		paging: false,
		scrollX: Math.floor(dtWidth / 100) * 100, // round down to nearest hundred
		scrollY: dtHeight,
		scrollCollapse: true
	});
	$(".dataTables_wrapper").css({"max-width": dtWidth});
}

function placeBsBtn() {
	const honkalculator = "<button style='position:absolute' class='bs-btn bs-btn-default'>Honkalculate</button>";
	$("#holder-2_wrapper").prepend(honkalculator);
	$(".bs-btn").click(function () {
		const formats = getSelectedTiers();
		if (!formats.length) {
			$(".bs-btn").popover({
				content: "No format selected",
				placement: "right"
			}).popover('show');
			setTimeout(function () { $(".bs-btn").popover('destroy'); }, 1350);
		}
		table.clear();
		performCalculations();
	});
}

$(".mode").change(function () {
	let params;
	if ($("#one-vs-one").prop("checked")) {
		params = new URLSearchParams(window.location.search);
		params.delete('mode');
		params = '' + params;
		window.location.replace('index' + linkExtension + (params.length ? '?' + params : ''));
	} else if ($("#randoms").prop("checked")) {
		params = new URLSearchParams(window.location.search);
		params.delete('mode');
		params = '' + params;
		window.location.replace('randoms' + linkExtension + (params.length ? '?' + params : ''));
	} else {
		params = new URLSearchParams(window.location.search);
		params.set('mode', $(this).attr("id"));
		window.location.replace('honkalculate' + linkExtension + '?' + params);
	}
});

$(".tiers label").mouseup(function () {
	const oldID = $('.tiers input:checked').attr("id");
	const newID = $(this).attr("for");
	if ((oldID === "Doubles" || startsWith(oldID, "VGC")) && (newID !== oldID)) {
		$("#singles-format").attr("disabled", false);
		$("#singles-format").prop("checked", true);
	}
	if ((startsWith(oldID, "VGC") || oldID === "LC") && (!startsWith(newID, "VGC") && newID !== "LC")) {
		setLevel("100");
	}
});

$(".tiers input").change(function () {
	const type = $(this).attr("type");
	const id = $(this).attr("id");
	$(".tiers input").not(":" + type).prop("checked", false); // deselect all radios if a checkbox is checked, and vice-versa

	if (id === "Doubles" || startsWith(id, "VGC")) {
		$("#doubles-format").prop("checked", true);
		$("#singles-format").attr("disabled", true);
	}

	if (id === "LC" && $('.level').val() !== "5") {
		setLevel("5");
	}

	if (startsWith(id, "VGC") && $('.level').val() !== "50") {
		setLevel("50");
	}
});

function setLevel(lvl) {
	$('.level').val(lvl);
	$('.level').keyup();
	$('.level').popover({
		content: "Level has been set to " + lvl,
		placement: "right"
	}).popover('show');
	setTimeout(function () { $('.level').popover('destroy'); }, 1350);
}

$(".set-selector").change(function (e) {
	let genWasChanged;
	const format = getSelectedTiers()[0];
	if (genWasChanged) {
		genWasChanged = false;
	} else if (startsWith(format, "VGC") && $('.level').val() !== "50") {
		setLevel("50");
	} else if (format === "LC" && $('.level').val() !== "5") {
		setLevel("5");
	}
});

var dtHeight, dtWidth;
$(document).ready(function () {
	const params = new URLSearchParams(window.location.search);
	window.mode = params.get("mode");
	if (window.mode) {
		if (window.mode === "randoms") {
			window.location.replace("randoms" + linkExtension + "?" + params);
		} else if (window.mode !== "one-vs-all" && window.mode !== "all-vs-one") {
			window.location.replace("index" + linkExtension + "?" + params);
		}
	} else {
		window.mode = "one-vs-all";
	}

	$("#" + mode).prop("checked", true);
	$("#holder-2 th:first").text((mode === "one-vs-all") ? "Defender" : "Attacker");
	$("#holder-2").show();

	calcDTDimensions();
	constructDataTable();
	placeBsBtn();
});

function calcDTDimensions() {
	$("#holder-2").DataTable({
		dom: 'C<"clear">frti'
	});

	const theadBottomOffset = getBottomOffset($(".sorting"));
	const heightUnderDT = getBottomOffset($(".holder-0")) - getBottomOffset($("#holder-2 tbody"));
	dtHeight = $(document).height() - theadBottomOffset - heightUnderDT;
	dtWidth = $(window).width() - $("#holder-2").offset().left;
	dtWidth -= 2 * parseFloat($(".holder-0").css("padding-right"));
}

function getBottomOffset(obj) {
	return obj.offset().top + obj.outerHeight();
}
