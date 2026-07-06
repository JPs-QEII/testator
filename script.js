(function () {
	'use strict';

	var SECTION_IDS = ['screening', 'gate-trust', 'gate-unsupported', 'will-form-section'];
	var MAX_EXECUTORS = 4;

	var screeningForm = document.getElementById('screening-form');
	var form = document.getElementById('will-form');
	var executorList = document.getElementById('executor-list');
	var addExecutorBtn = document.getElementById('add-executor');

	var executorMode = 'single';
	var executorUid = 0;

	function showSection(id) {
		SECTION_IDS.forEach(function (sectionId) {
			document.getElementById(sectionId).hidden = sectionId !== id;
		});
	}

	document.querySelectorAll('[data-action="back-to-screening"]').forEach(function (btn) {
		btn.addEventListener('click', function () { showSection('screening'); });
	});

	screeningForm.addEventListener('submit', function (event) {
		event.preventDefault();

		var answers = new FormData(screeningForm);
		var hasTrust = answers.get('hasTrust');
		var hasMinors = answers.get('hasMinors');
		var hasPets = answers.get('hasPets');
		var singleBeneficiary = answers.get('singleBeneficiary');

		if (hasTrust === 'yes') {
			showSection('gate-trust');
			return;
		}

		if (hasMinors === 'yes' || hasPets === 'yes' || singleBeneficiary === 'no') {
			showSection('gate-unsupported');
			return;
		}

		setExecutorMode(answers.get('executorMode'));
		showSection('will-form-section');
	});

	function minExecutors() {
		return executorMode === 'joint' ? 2 : 1;
	}

	function createExecutorBlock() {
		executorUid += 1;
		var uid = executorUid;

		var block = document.createElement('div');
		block.className = 'executor-block';

		var header = document.createElement('div');
		header.className = 'executor-block-header';

		var title = document.createElement('span');
		header.appendChild(title);

		var removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'remove-executor';
		removeBtn.textContent = 'Remove';
		removeBtn.addEventListener('click', function () { removeExecutorBlock(block); });
		header.appendChild(removeBtn);

		block.appendChild(header);

		var nameLabel = document.createElement('label');
		nameLabel.setAttribute('for', 'executor-name-' + uid);
		nameLabel.textContent = 'Full legal name';
		block.appendChild(nameLabel);

		var nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.id = 'executor-name-' + uid;
		nameInput.className = 'executor-name-input';
		block.appendChild(nameInput);

		var addressLabel = document.createElement('label');
		addressLabel.setAttribute('for', 'executor-address-' + uid);
		addressLabel.textContent = 'Full address';
		block.appendChild(addressLabel);

		var addressInput = document.createElement('textarea');
		addressInput.id = 'executor-address-' + uid;
		addressInput.className = 'executor-address-input';
		addressInput.rows = 2;
		block.appendChild(addressInput);

		return block;
	}

	function refreshExecutorUI() {
		var blocks = executorList.querySelectorAll('.executor-block');
		var min = minExecutors();

		blocks.forEach(function (block, index) {
			block.querySelector('.executor-block-header span').textContent =
				executorMode === 'joint' ? ('Executor ' + (index + 1)) : 'Executor';
			block.querySelector('.remove-executor').hidden = blocks.length <= min;
		});

		addExecutorBtn.hidden = executorMode === 'single' || blocks.length >= MAX_EXECUTORS;
	}

	function addExecutorBlock() {
		if (executorList.querySelectorAll('.executor-block').length >= MAX_EXECUTORS) return;
		executorList.appendChild(createExecutorBlock());
		refreshExecutorUI();
	}

	function removeExecutorBlock(block) {
		if (executorList.querySelectorAll('.executor-block').length <= minExecutors()) return;
		block.remove();
		refreshExecutorUI();
	}

	function setExecutorMode(mode) {
		executorMode = mode;
		var blocks = executorList.querySelectorAll('.executor-block');

		if (mode === 'single') {
			for (var i = blocks.length - 1; i >= 1; i--) {
				blocks[i].remove();
			}
		}

		while (executorList.querySelectorAll('.executor-block').length < minExecutors()) {
			executorList.appendChild(createExecutorBlock());
		}

		refreshExecutorUI();
	}

	addExecutorBtn.addEventListener('click', addExecutorBlock);

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		clearErrors();

		var data = collectFormData();
		var executorBlocks = Array.prototype.slice.call(executorList.querySelectorAll('.executor-block'));
		var missing = validate(data, executorBlocks);

		if (missing.length > 0) {
			missing.forEach(function (el) { el.classList.add('field-error'); });
			missing[0].focus();
			return;
		}

		generatePdf(data);
	});

	function clearErrors() {
		form.querySelectorAll('.field-error').forEach(function (el) {
			el.classList.remove('field-error');
		});
	}

	function collectFormData() {
		var executors = [];
		executorList.querySelectorAll('.executor-block').forEach(function (block) {
			executors.push({
				name: block.querySelector('.executor-name-input').value.trim(),
				address: block.querySelector('.executor-address-input').value.trim()
			});
		});

		return {
			testatorName: form.testatorName.value.trim(),
			testatorAddress: form.testatorAddress.value.trim(),
			testatorDob: form.testatorDob.value,
			executors: executors,
			beneficiaryName: form.beneficiaryName.value.trim()
		};
	}

	function validate(data, executorBlocks) {
		var missing = [];

		var staticRequired = [
			[document.getElementById('testator-name'), data.testatorName],
			[document.getElementById('testator-address'), data.testatorAddress],
			[document.getElementById('testator-dob'), data.testatorDob],
			[document.getElementById('beneficiary-name'), data.beneficiaryName]
		];
		staticRequired.forEach(function (pair) {
			if (!pair[1]) missing.push(pair[0]);
		});

		executorBlocks.forEach(function (block, index) {
			if (!data.executors[index].name) missing.push(block.querySelector('.executor-name-input'));
			if (!data.executors[index].address) missing.push(block.querySelector('.executor-address-input'));
		});

		return missing;
	}

	function formatDob(isoDate) {
		var parts = isoDate.split('-').map(Number);
		var date = new Date(parts[0], parts[1] - 1, parts[2]);
		var months = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
	}

	function joinWithAnd(items) {
		if (items.length === 1) return items[0];
		if (items.length === 2) return items[0] + ' and ' + items[1];
		return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
	}

	function buildWillText(data) {
		var openingLines = [
			'This is the last Will and Testament of me,',
			data.testatorName + ',',
			'of ' + data.testatorAddress + ',',
			'born ' + formatDob(data.testatorDob) + ' —'
		];

		var executorDescriptions = data.executors.map(function (executor) {
			return executor.name + ' of ' + executor.address;
		});

		var executorClause = data.executors.length === 1
			? 'I APPOINT ' + executorDescriptions[0] + ' to be the Executor and Trustee of this my Will.'
			: 'I APPOINT ' + joinWithAnd(executorDescriptions) + ' to act jointly as the Executors and Trustees of this my Will.';

		var clauses = [
			'I REVOKE all former wills and codicils and declare this to be my last Will.',
			executorClause,
			'I GIVE, DEVISE AND BEQUEATH the whole of my estate, both real and personal, UNTO ' +
				data.beneficiaryName + ' absolutely.'
		];

		return { openingLines: openingLines, clauses: clauses };
	}

	function generatePdf(data) {
		var content = buildWillText(data);

		var result = renderDocument(data, content, false);
		if (result.pageCount > 1) {
			result = renderDocument(data, content, true);
		}

		addPageDecorations(result.doc, data, result.pageCount);

		var filenameSafeName = data.testatorName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
		result.doc.save('will-' + (filenameSafeName || 'draft') + '.pdf');
	}

	function addPageDecorations(doc, data, pageCount) {
		var marginLeft = 25;
		var marginRight = 25;
		var pageWidth = doc.internal.pageSize.getWidth();
		var pageHeight = doc.internal.pageSize.getHeight();
		var usableWidth = pageWidth - marginLeft - marginRight;

		for (var p = 1; p <= pageCount; p++) {
			doc.setPage(p);

			if (p > 1) {
				doc.setFont('times', 'italic');
				doc.setFontSize(9);
				doc.text('Last Will and Testament of ' + data.testatorName + ' — continued', marginLeft, 15);
			}

			if (pageCount > 1) {
				doc.setFont('times', 'normal');
				doc.setFontSize(9);
				doc.text('Page ' + p + ' of ' + pageCount, pageWidth / 2, pageHeight - 12, { align: 'center' });

				if (p < pageCount) {
					var signatureStripY = pageHeight - 22;
					var signatureStripGap = 8;
					var signatureStripWidth = (usableWidth - 2 * signatureStripGap) / 3;
					var labels = ['Signature of Testator', 'Signature of First Witness', 'Signature of Second Witness'];
					labels.forEach(function (label, idx) {
						var x = marginLeft + idx * (signatureStripWidth + signatureStripGap);
						doc.setLineWidth(0.2);
						doc.line(x, signatureStripY, x + signatureStripWidth, signatureStripY);
						doc.setFont('times', 'normal');
						doc.setFontSize(8);
						doc.text(label, x, signatureStripY + 4);
					});
				}
			}
		}
	}

	function renderDocument(data, content, reserveFooter) {
		var jsPDF = window.jspdf.jsPDF;
		var doc = new jsPDF({ unit: 'mm', format: 'a4' });

		var marginLeft = 25;
		var marginRight = 25;
		var pageWidth = doc.internal.pageSize.getWidth();
		var pageHeight = doc.internal.pageSize.getHeight();
		var usableWidth = pageWidth - marginLeft - marginRight;
		var topMarginFirst = 25;
		var topMarginContinuation = reserveFooter ? 34 : 25;
		var bottomMargin = reserveFooter ? 34 : 25;
		var y = topMarginFirst;
		var lineHeight = 6;

		function ensureSpace(needed) {
			if (y + needed > pageHeight - bottomMargin) {
				doc.addPage();
				y = topMarginContinuation;
			}
		}

		function writeParagraph(text, options) {
			options = options || {};
			doc.setFont('times', options.bold ? 'bold' : 'normal');
			doc.setFontSize(options.size || 12);
			var lines = doc.splitTextToSize(text, usableWidth);
			lines.forEach(function (line) {
				ensureSpace(lineHeight);
				doc.text(line, options.center ? pageWidth / 2 : marginLeft, y, options.center ? { align: 'center' } : undefined);
				y += lineHeight;
			});
		}

		function spacer(amount) {
			y += amount;
		}

		function signatureLine(label, width, x) {
			ensureSpace(20);
			doc.setLineWidth(0.2);
			doc.line(x, y, x + width, y);
			doc.setFont('times', 'normal');
			doc.setFontSize(10);
			doc.text(label, x, y + 4);
		}

		// Title
		doc.setFont('times', 'bold');
		doc.setFontSize(16);
		doc.text('LAST WILL AND TESTAMENT', pageWidth / 2, y, { align: 'center' });
		y += 14;

		content.openingLines.forEach(function (line) {
			writeParagraph(line);
		});
		spacer(4);

		content.clauses.forEach(function (clause, index) {
			writeParagraph((index + 1) + '. ' + clause);
			spacer(3);
		});

		spacer(6);
		writeParagraph('IN WITNESS WHEREOF I have to this my last Will and Testament set my hand this ' +
			'_____________ day of _____________________ 20______ in the State of Queensland.');
		spacer(12);

		var colWidth = (usableWidth - 10) / 2;
		var col2X = marginLeft + colWidth + 10;

		writeParagraph('SIGNED BY ' + data.testatorName + ' —');
		spacer(16);

		ensureSpace(20);
		signatureLine(data.testatorName, colWidth, marginLeft);
		spacer(14);

		writeParagraph('IN OUR JOINT PRESENCE AND ATTESTED BY US IN THE PRESENCE OF THE AFORENAMED TESTATOR AND EACH OTHER:');
		spacer(10);

		ensureSpace(20);
		signatureLine('Signature of First Witness', colWidth, marginLeft);
		signatureLine('Signature of Second Witness', colWidth, col2X);
		spacer(16);

		ensureSpace(20);
		signatureLine('Full name', colWidth, marginLeft);
		signatureLine('Full name', colWidth, col2X);
		spacer(14);

		ensureSpace(20);
		signatureLine('Occupation', colWidth, marginLeft);
		signatureLine('Occupation', colWidth, col2X);
		spacer(14);

		ensureSpace(20);
		signatureLine('Address', colWidth, marginLeft);
		signatureLine('Address', colWidth, col2X);
		spacer(7);

		ensureSpace(20);
		signatureLine('', colWidth, marginLeft);
		signatureLine('', colWidth, col2X);

		return { doc: doc, pageCount: doc.internal.getNumberOfPages() };
	}
})();
