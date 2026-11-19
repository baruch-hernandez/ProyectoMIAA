package com.miaa.lecturas;

import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling // PresenciaService (marcar inactivos) y GeocodificadorInverso
public class LecturasBackendApplication {

	/** La hora de Aguascalientes. */
	static final String ZONA = "America/Mexico_City";

	public static void main(String[] args) {
		// Las fechas de reportes y notas (LocalDateTime.now()) y el filtro por días del admin usan la zona
		// de la JVM: sin esto, en un servidor en UTC un reporte de las 19:00 quedaría como del día siguiente.
		TimeZone.setDefault(TimeZone.getTimeZone(ZONA));
		avisarSiLaZonaHorariaEsVieja();
		SpringApplication.run(LecturasBackendApplication.class, args);
	}

	/**
	 * México quitó el horario de verano en 2022. Un JDK más viejo (p. ej. 18.0.2) no lo sabe y, de abril
	 * a octubre, pone las fechas de reportes y notas (LocalDateTime) una hora adelantadas.
	 */
	static boolean zonaHorariaVieja() {
		return !ZoneId.of(ZONA).getRules()
				.getOffset(Instant.parse("2026-07-01T18:00:00Z")).equals(ZoneOffset.ofHours(-6));
	}

	private static void avisarSiLaZonaHorariaEsVieja() {
		if (zonaHorariaVieja()) {
			LoggerFactory.getLogger(LecturasBackendApplication.class).error(
					"Este JDK ({}) cree que México sigue con horario de verano: de abril a octubre las horas saldrán "
							+ "1 h adelantadas. Corre el backend con un JDK 17 o 21 actualizado (JAVA_HOME).",
					System.getProperty("java.version"));
		}
	}
}
