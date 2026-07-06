(function () {
	'use strict';

	var form = document.getElementById('will-form');

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		clearErrors();

		var data = collectFormData();
		var missing = validate(data);

		if (missing.length > 0) {
			missing.forEach(function (id) {
				var field = document.getElementById(id);
				if (field) field.classList.add('field-error');
			});
			missing[0] && document.getElementById(missing[0]).focus();
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
		return {
			testatorName: form.testatorName.value.trim(),
			testatorAddress: form.testatorAddress.value.trim(),
			testatorDob: form.testatorDob.value,
			testatorOccupation: form.testatorOccupation.value.trim(),
			executorName: form.executorName.value.trim(),
			executorAddress: form.executorAddress.value.trim(),
			beneficiaryName: form.beneficiaryName.value.trim()
		};
	}

	function validate(data) {
		var required = [
			['testator-name', data.testatorName],
			['testator-address', data.testatorAddress],
			['testator-dob', data.testatorDob],
			['executor-name', data.executorName],
			['executor-address', data.executorAddress],
			['beneficiary-name', data.beneficiaryName]
		];
		return required.filter(function (pair) { return !pair[1]; }).map(function (pair) { return pair[0]; });
	}

	function formatDob(isoDate) {
		var parts = isoDate.split('-').map(Number);
		var date = new Date(parts[0], parts[1] - 1, parts[2]);
		var months = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
	}

	function buildWillText(data) {
		var opening = 'THIS IS THE LAST WILL AND TESTAMENT OF ME, ' + data.testatorName +
			' (born ' + formatDob(data.testatorDob) + '), of ' + data.testatorAddress +
			', in the State of Queensland' + (data.testatorOccupation ? ', ' + data.testatorOccupation : '') + '.';

		var clauses = [
			'I REVOKE all former wills and codicils and declare this to be my last Will.',
			'I APPOINT ' + data.executorName + ' of ' + data.executorAddress +
				' to be the Executor and Trustee of this my Will (hereinafter called "my Trustee").',
			'I GIVE, DEVISE AND BEQUEATH the whole of my estate, both real and personal, UNTO ' +
				data.beneficiaryName + ' absolutely.'
		];

		return { opening: opening, clauses: clauses };
	}

	function generatePdf(data) {
		var jsPDF = window.jspdf.jsPDF;
		var doc = new jsPDF({ unit: 'mm', format: 'a4' });

		var marginLeft = 25;
		var marginRight = 25;
		var pageWidth = doc.internal.pageSize.getWidth();
		var pageHeight = doc.internal.pageSize.getHeight();
		var usableWidth = pageWidth - marginLeft - marginRight;
		var bottomMargin = 25;
		var y = 25;
		var lineHeight = 6;

		function ensureSpace(needed) {
			if (y + needed > pageHeight - bottomMargin) {
				doc.addPage();
				y = 25;
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
			doc.text(label, x, y + 5);
		}

		// Title
		doc.setFont('times', 'bold');
		doc.setFontSize(16);
		doc.text('LAST WILL AND TESTAMENT', pageWidth / 2, y, { align: 'center' });
		y += 14;

		var content = buildWillText(data);

		writeParagraph(content.opening);
		spacer(4);

		content.clauses.forEach(function (clause, index) {
			writeParagraph((index + 1) + '. ' + clause);
			spacer(3);
		});

		spacer(8);
		writeParagraph('IN WITNESS WHEREOF I have to this my last Will and Testament set my hand this ' +
			'_____________ day of _____________________ 20______.');
		spacer(14);

		var colWidth = (usableWidth - 10) / 2;
		var col2X = marginLeft + colWidth + 10;

		writeParagraph('SIGNED BY ' + data.testatorName + ' —');
		spacer(16);

		ensureSpace(20);
		signatureLine(data.testatorName, colWidth, marginLeft);
		spacer(14);

		writeParagraph('IN OUR JOINT PRESENCE AND ATTESTED BY US IN THE PRESENCE OF HIM/HER AND EACH OTHER:');
		spacer(10);

		ensureSpace(20);
		signatureLine('Signature of witness 1', colWidth, marginLeft);
		signatureLine('Signature of witness 2', colWidth, col2X);
		spacer(13);

		ensureSpace(20);
		signatureLine('Full name', colWidth, marginLeft);
		signatureLine('Full name', colWidth, col2X);
		spacer(13);

		ensureSpace(20);
		signatureLine('Occupation', colWidth, marginLeft);
		signatureLine('Occupation', colWidth, col2X);
		spacer(13);

		ensureSpace(20);
		signatureLine('Address', colWidth, marginLeft);
		signatureLine('Address', colWidth, col2X);

		var filenameSafeName = data.testatorName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
		doc.save('will-' + (filenameSafeName || 'draft') + '.pdf');
	}
})();
