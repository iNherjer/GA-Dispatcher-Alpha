// Frozen original training voice/control functions, 2026-09-23.
function _trainingProcedureAudioKey(kind = 'event', event = null) {
    const ex = String(event?.exerciseId || event?.exerciseType || '').trim();
    return _paxMissionAudioKey(`training-${kind}${ex ? `-${ex}` : ''}`);
}

function _trainingProcedureEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'training_complete') return 'training_complete';
    if (type === 'training_required_complete') return 'training_required_complete';
    if (type === 'training_ready_available') return 'training_ready_available';
    if (type === 'training_start_available') return 'training_start_available';
    if (type === 'training_values_correct') return 'training_values_correct';
    if (type === 'training_values_deviation') return 'training_values_deviation';
    if (type === 'training_optional_started') return 'training_optional_started';
    if (type === 'stall_break_detected') return 'stall_break_detected';
    if (type === 'training_wait_altitude') return 'training_wait_altitude';
    if (type === 'exercise_instruction') {
        const exerciseType = String(event?.exerciseType || '').toLowerCase();
        const bank = Math.round(Number(event?.targetBankDeg || 0));
        if (exerciseType === 'constant_bank_360') return bank >= 40 ? 'training_setup_turn_360_45' : 'training_setup_turn_360_30';
        if (exerciseType === 'turn_180') return 'training_setup_turn_180';
        if (exerciseType === 'altitude_step_hold') return 'training_setup_altitude_step';
        if (exerciseType === 'stall_recovery') return 'training_setup_stall';
        return 'training_exercise_started';
    }
    if (type === 'training_caution') {
        const caution = String(event?.caution || '').toLowerCase();
        if (caution === 'altitude') return 'training_caution_altitude';
        if (caution === 'heading') return 'training_caution_heading';
        if (caution === 'bank') return 'training_caution_bank';
        if (caution === 'speed') return 'training_caution_speed';
        if (caution === 'rollout_soon') return 'training_caution_rollout_soon';
        if (caution === 'rollout') return 'training_caution_rollout';
        if (caution === 'leveloff') return 'training_caution_leveloff';
        if (caution === 'stall_setup') return 'stall_caution_setup';
        if (caution === 'stall_hold_altitude') return 'stall_caution_hold_altitude';
        if (caution === 'stall_wings_level') return 'stall_caution_wings_level';
        if (caution === 'stall_recovery') return 'stall_caution_recovery';
        if (caution === 'stall_stop_sink') return 'stall_caution_stop_sink';
        if (caution === 'stall_secondary') return 'stall_caution_secondary';
        return 'training_caution_general';
    }
    if (type === 'exercise_repeat_required') {
        const reason = String(event?.reason || '').toLowerCase();
        if (/altitude|hoehe/.test(reason)) return 'training_repeat_altitude';
        if (/heading|course|kurs/.test(reason)) return 'training_repeat_heading';
        if (/bank|direction|overshoot|rollout/.test(reason)) return 'training_repeat_bank';
        if (/speed|ias/.test(reason)) return 'training_repeat_speed';
        return 'training_repeat_required';
    }
    if (type === 'exercise_pass_clean') {
        const exerciseType = String(event?.exerciseType || '').toLowerCase();
        if (exerciseType === 'stall_recovery') return 'stall_good_recovery';
        if (exerciseType === 'constant_bank_360' || exerciseType === 'turn_180') return 'training_pass_turn';
        if (exerciseType === 'altitude_step_hold') return 'training_pass_altitude';
        return 'training_pass_clean';
    }
    if (type === 'phase_started') {
        const phase = String(event?.phase || '').toLowerCase();
        if (phase === 'altitude_change') return 'training_altitude_change';
        if (phase === 'hold_final') return 'training_hold_new_altitude';
        if (phase === 'hold_initial') return 'training_hold_course_altitude';
        if (phase === 'entry') return 'training_turn_entry';
        if (phase === 'rollout') return 'training_turn_rollout';
        if (phase === 'approach') return 'stall_approach';
        if (phase === 'hold_to_break') return 'stall_hold_to_break';
        if (phase === 'recovery') return 'stall_recovery';
    }
    if (type === 'exercise_started') return 'training_exercise_started';
    if (type === 'training_started') return 'training_started';
    return '';
}

function _trainingProcedureVoiceText(kind = 'training_started') {
    switch (kind) {
        case 'training_started':
            return 'Training aktiv. Wir bewerten ab jetzt Hoehe, Kurs, Bank und saubere Korrekturen.';
        case 'training_exercise_started':
            return 'Neue Uebung. Erst stabilisieren, dann sauber und ohne Hast einleiten.';
        case 'training_ready_available':
            return 'Das ist eine gute Trainingshoehe. Stabilisiere die Maschine, und wenn du bereit bist, gib mir im Pax-Fenster die Bereitschaft.';
        case 'training_start_available':
            return 'Ausgangslage passt. Wenn du bereit bist, starte jetzt die Übung im Pax-Fenster.';
        case 'training_optional_started':
            return 'Zusatzuebung angenommen. Das ist freiwillig; die vorbereiteten Uebungen sitzen, jetzt fliegen wir sauber weiter.';
        case 'training_instruction_turn_360_30':
            return 'Aufgabe: ein Vollkreis mit dreissig Grad Bank. Hoehe maximal fuenfzig Fuss abweichen lassen und sauber auf Ausgangskurs ausleiten. Nimm zuerst eine ruhige Ausgangslage ein; danach startest du die Übung im Pax-Fenster.';
        case 'training_instruction_turn_360_45':
            return 'Aufgabe: ein Vollkreis mit fuenfundvierzig Grad Bank. Hoehe verteidigen, G-Belastung ruhig halten und sauber ausleiten. Erst stabilisieren, dann die Übung im Pax-Fenster starten.';
        case 'training_instruction_turn_180':
            return 'Aufgabe: eine hundertachtzig-Grad-Wende. Hoehe halten, gleichmaessig drehen und den Zielkurs innerhalb von fuenf Grad treffen. Erst stabilisieren, dann die Übung im Pax-Fenster starten.';
        case 'training_instruction_altitude_step':
            return 'Aufgabe: eine Minute Kurs und Hoehe halten, dann fuenfhundert Fuss wechseln und danach wieder eine Minute stabil geradeaus. Erst die Ausgangslage beruhigen, dann im Pax-Fenster starten.';
        case 'training_instruction_stall':
            return 'Aufgabe: Stall bis zum echten Break. Hoehe halten, nicht vorzeitig nachdruecken, dann sauber abfangen. Erst eine sichere stabile Ausgangslage herstellen, dann im Pax-Fenster starten.';
        case 'training_setup_turn_360_30':
            return 'Aufgabe: ein Vollkreis mit dreissig Grad Bank. Hoehe maximal fuenfzig Fuss abweichen lassen und sauber auf Ausgangskurs ausleiten. Nimm zuerst eine ruhige Ausgangslage ein; danach startest du die Übung im Pax-Fenster.';
        case 'training_setup_turn_360_45':
            return 'Aufgabe: ein Vollkreis mit fuenfundvierzig Grad Bank. Hoehe verteidigen, G-Belastung ruhig halten und sauber ausleiten. Erst stabilisieren, dann die Übung im Pax-Fenster starten.';
        case 'training_setup_turn_180':
            return 'Aufgabe: eine hundertachtzig-Grad-Wende. Hoehe halten, gleichmaessig drehen und den Zielkurs innerhalb von fuenf Grad treffen. Erst stabilisieren, dann die Übung im Pax-Fenster starten.';
        case 'training_setup_altitude_step':
            return 'Aufgabe: eine Minute Kurs und Hoehe halten, dann fuenfhundert Fuss wechseln und danach wieder eine Minute stabil geradeaus. Erst die Ausgangslage beruhigen, dann im Pax-Fenster starten.';
        case 'training_setup_stall':
            return 'Aufgabe: Stall bis zum echten Break. Hoehe halten, nicht vorzeitig nachdruecken, dann sauber abfangen. Erst eine sichere stabile Ausgangslage herstellen, dann im Pax-Fenster starten.';
        case 'training_values_correct':
            return 'Die Werte passen. Genau so weiter.';
        case 'training_values_deviation':
            return 'Die Sollwerte sind verlassen. Ruhig zurück ins Band korrigieren.';
        case 'training_turn_entry':
            return 'Jetzt den Ziel-Bankwinkel aufnehmen und die Hoehe halten.';
        case 'training_turn_rollout':
            return 'Ausleiten. Kurs sauber treffen und die Flaechen waagerecht bringen.';
        case 'training_hold_course_altitude':
            return 'Eine Minute geradeaus. Kurs und Hoehe im engen Band halten.';
        case 'training_altitude_change':
            return 'Jetzt den Hoehenwechsel einleiten. Kurs halten und die Geschwindigkeit nicht weglaufen lassen.';
        case 'training_hold_new_altitude':
            return 'Neue Hoehe erreicht. Wieder eine Minute geradeaus und stabil halten.';
        case 'stall_approach':
            return 'Stall-Uebung beginnt. Leistung rausnehmen, Kurs halten und die Hoehe weiter verteidigen.';
        case 'stall_hold_to_break':
            return 'Weiter halten. Nicht zu frueh nachdruecken, wir warten auf den echten Break.';
        case 'stall_break_detected':
            return 'Break erkannt. Jetzt abfangen, Fluegel gerade, Fahrt aufbauen und danach sanft stabilisieren.';
        case 'stall_recovery':
            return 'Recovery laeuft. Fluegel waagerecht, Stallwarnung raus und Sinkrate stoppen.';
        case 'training_pass_clean':
            return 'Sauberer Durchlauf. Die Uebung zaehlt.';
        case 'training_pass_turn':
            return 'Guter Durchlauf. Rollout und Hoehe waren sauber genug, die Wende zaehlt.';
        case 'training_pass_altitude':
            return 'Gut gehalten. Kurs und Hoehenband passen, der Hoehenwechsel zaehlt.';
        case 'stall_good_recovery':
            return 'Saubere Recovery. Break erkannt, Fluegel stabilisiert und der Hoehenverlust bleibt brauchbar.';
        case 'training_required_complete':
            return 'Die zwei vorbereiteten Uebungen sind sauber genug im Kasten, du bist fuer die Rueckkehr frei. Wenn du willst, kannst du noch eine Zusatzuebung anfragen.';
        case 'training_caution_altitude':
            return 'Die Hoehe laeuft aus dem Band. Kleine Korrektur, nicht jagen.';
        case 'training_caution_heading':
            return 'Der Kurs driftet. Blick raus, Referenz halten und sanft zurueckfuehren.';
        case 'training_caution_bank':
            return 'Bankwinkel stabilisieren. Nicht nachdruecken, sauber halten.';
        case 'training_caution_speed':
            return 'Die Geschwindigkeit laeuft weg. Energie ruhiger fuehren.';
        case 'training_caution_rollout_soon':
            return 'Rollout kommt gleich. Vorplanen, Bank rausnehmen und Zielkurs treffen.';
        case 'training_caution_rollout':
            return 'Rollout noch nicht sauber. Flaechen waagerecht und Kurs ruhig einfangen.';
        case 'training_caution_leveloff':
            return 'Zielhoehe kommt. Leistung und Pitch vorbereiten, nicht durchschiessen.';
        case 'training_caution_general':
            return 'Kleine Korrektur noetig. Stabilisieren und ruhig weiterfliegen.';
        case 'training_wait_altitude':
            return 'Fuer die Uebung brauchen wir erst mehr Sicherheitshoehe. Weiter steigen und stabilisieren.';
        case 'stall_caution_setup':
            return 'Erst sauber stabilisieren: Kurs halten, Fluegel gerade, Hoehe ruhig.';
        case 'stall_caution_hold_altitude':
            return 'Hoehe weiter verteidigen. Noch nicht nachdruecken, sauber bis zum Break halten.';
        case 'stall_caution_wings_level':
            return 'Fluegel waagerecht halten. Keine Drehung in den Stall mitnehmen.';
        case 'stall_caution_recovery':
            return 'Recovery weiterfuehren: Nase loesen, Fahrt aufbauen, dann erst sanft abfangen.';
        case 'stall_caution_stop_sink':
            return 'Sinkrate stoppen. Fahrt ist wieder da, jetzt weich abfangen.';
        case 'stall_caution_secondary':
            return 'Vorsicht vor dem Sekundaerstall. Nicht zu frueh wieder ziehen.';
        case 'training_repeat_altitude':
            return 'Die Hoehe war ausserhalb der Toleranz. Wir setzen die Uebung noch einmal sauber an.';
        case 'training_repeat_heading':
            return 'Der Kurs war nicht sauber genug. Wir wiederholen mit ruhigerem Blick auf die Referenz.';
        case 'training_repeat_bank':
            return 'Bankwinkel oder Ausleitung waren nicht sauber. Wir nehmen den Durchlauf noch einmal.';
        case 'training_repeat_speed':
            return 'Die Geschwindigkeit ist zu weit weggelaufen. Bitte noch einmal mit ruhigerer Energie fuehren.';
        case 'training_repeat_required':
            return 'Kriterium verfehlt. Kein Problem, wir wiederholen die Uebung sauber.';
        case 'training_complete':
            return 'Training abgeschlossen. Wir haben die Uebungen im Kasten und werten nach der Landung kurz aus.';
        default:
            return '';
    }
}

function _trainingProcedurePickEvent(events = []) {
    const ranked = (Array.isArray(events) ? events : [])
        .map(event => ({ event, kind: _trainingProcedureEventKind(event) }))
        .filter(item => item.kind);
    if (!ranked.length) return null;
    const priority = [
        'training_complete',
        'training_required_complete',
        'stall_break_detected',
        'training_repeat_altitude',
        'training_repeat_heading',
        'training_repeat_bank',
        'training_repeat_speed',
        'training_repeat_required',
        'training_values_deviation',
        'stall_caution_secondary',
        'stall_caution_stop_sink',
        'stall_caution_recovery',
        'stall_caution_wings_level',
        'stall_caution_hold_altitude',
        'training_caution_rollout',
        'training_caution_leveloff',
        'training_caution_altitude',
        'training_caution_heading',
        'training_caution_bank',
        'training_caution_speed',
        'training_caution_rollout_soon',
        'training_caution_general',
        'stall_caution_setup',
        'training_pass_clean',
        'training_pass_turn',
        'training_pass_altitude',
        'training_values_correct',
        'stall_good_recovery',
        'training_setup_turn_360_30',
        'training_setup_turn_360_45',
        'training_setup_turn_180',
        'training_setup_altitude_step',
        'training_setup_stall',
        'training_ready_available',
        'training_start_available',
        'training_optional_started',
        'stall_hold_to_break',
        'stall_recovery',
        'training_altitude_change',
        'training_hold_new_altitude',
        'training_turn_rollout',
        'training_turn_entry',
        'stall_approach',
        'training_hold_course_altitude',
        'training_exercise_started',
        'training_wait_altitude',
        'training_started'
    ];
    return ranked.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))[0] || null;
}

function _handleTrainingProcedureEvents(events = [], recipe = null) {
    const picked = _trainingProcedurePickEvent(events);
    if (!picked) return;
    const kind = picked.kind;
    const event = picked.event || null;
    _paxLog(`Training-Prozedur Event: ${kind}`, 'event');
    if (typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot(`training-procedure-${kind}`, { immediate: kind === 'training_complete' || kind === 'training_required_complete' });
    }
    const text = _trainingProcedureVoiceText(kind, event, recipe);
    if (!text) return;
    const speaker = _speakerSnapshotForMissionVoice('training-procedure');
    const label = kind === 'training_complete'
        ? 'Training abgeschlossen'
        : (kind.includes('repeat') ? 'Training Wiederholung' : (kind.includes('stall') ? 'Stall Training' : 'Training'));
    _speakPreparedText(_trainingProcedureAudioKey(kind, event), text, speaker, label, {
        tryStaticAudio: (playEpoch) => _paxTryPlayStaticTrainingVoice(kind, speaker, playEpoch)
    });
    _refreshTrainingProcedureMenu();
}

function paxTrainingProcedureReady() {
    if (typeof window.missionTrainingProcedure?.signalReady !== 'function') {
        _trainingProcedureControlSpeak('Trainingslogik ist noch nicht bereit. Halte den Flug stabil, ich melde mich gleich.', 'Training');
        return;
    }
    const result = window.missionTrainingProcedure.signalReady(
        (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
        window.activePassenger || null
    );
    const text = result?.ok
        ? 'Übung läuft ab jetzt. Ausgangskurs und Ausgangshöhe werden mit dem nächsten Messwert festgelegt.'
        : (result?.reason === 'required_complete'
            ? 'Die vorbereiteten Uebungen sind bereits erledigt. Wenn du noch mehr willst, frag eine Zusatzuebung an.'
            : (result?.reason === 'departure_distance'
                ? 'Noch keine Freigabe. Wir müssen zuerst mindestens fünf nautische Meilen vom Startplatz entfernt sein.'
                : (result?.reason === 'not_stable'
                    ? 'Noch nicht stabil genug. Halte die Flügel ruhig und die Vertikalgeschwindigkeit klein, dann wird der Startknopf frei.'
                    : 'Die Einweisung für diese Übung ist noch nicht abgeschlossen. Warte kurz auf meine Ansage.')));
    _trainingProcedureControlSpeak(text, 'Übungsstart');
    if (typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot('training-ready-button', { immediate: true });
    }
    _refreshTrainingProcedureMenu();
    _refreshPaxWidgetVisibility();
}

function paxTrainingProcedureAbort() {
    if (typeof window.missionTrainingProcedure?.abortExercise !== 'function') {
        _trainingProcedureControlSpeak('Der Abbruch ist gerade nicht verfügbar.', 'Training Abbruch');
        return;
    }
    const result = window.missionTrainingProcedure.abortExercise(
        (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
        window.activePassenger || null
    );
    const text = result?.ok
        ? 'Übung abgebrochen. Geh zurück in eine ruhige Ausgangslage. Ich erkläre den Durchlauf gleich noch einmal; danach startest du ihn erneut per Knopf.'
        : 'Es läuft gerade keine Übung, die ich abbrechen kann.';
    _trainingProcedureControlSpeak(text, 'Training Abbruch');
    if (typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot('training-abort-button', { immediate: true });
    }
    _refreshTrainingProcedureMenu();
    _refreshPaxWidgetVisibility();
}

function paxTrainingProcedureRequestExtra() {
    if (typeof window.missionTrainingProcedure?.requestOptionalExercise !== 'function') {
        _trainingProcedureControlSpeak('Zusatzuebungen sind in dieser Version noch nicht abrufbar.', 'Training');
        return;
    }
    const result = window.missionTrainingProcedure.requestOptionalExercise(
        (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
        window.activePassenger || null
    );
    const text = result?.ok
        ? 'Okay, wir nehmen noch eine freiwillige Zusatzuebung dazu. Ich sage sie gleich an.'
        : (result?.reason === 'required_open'
            ? 'Erst die zwei vorbereiteten Uebungen sauber abschliessen, danach koennen wir freiwillig erweitern.'
            : (result?.reason === 'active'
                ? 'Eine Uebung laeuft gerade schon. Flieg die erst sauber zu Ende.'
                : 'Fuer heute ist keine weitere Uebung mehr offen. Rueckkehr ist frei.'));
    _trainingProcedureControlSpeak(text, 'Training extra');
    if (typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot('training-extra-button', { immediate: true });
    }
    _refreshTrainingProcedureMenu();
    _refreshPaxWidgetVisibility();
}