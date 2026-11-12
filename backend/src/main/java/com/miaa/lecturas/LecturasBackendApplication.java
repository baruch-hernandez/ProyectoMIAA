package com.miaa.lecturas;

import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

@SpringBootApplication
public class LecturasBackendApplication {

	public static void main(String[] args) {
		avisarSiLaZonaHorariaEsVieja();
		SpringApplication.run(LecturasBackendApplication.class, args);
	}

	/**
	 * México quitó el horario de verano en 2022. Un JDK más viejo (p. ej. 18.0.2) no lo sabe y, de abril
	 * a octubre, pone las fechas de reportes y notas (LocalDateTime) una hora adelantadas.
	 */
	static boolean zonaHorariaVieja() {
		return !ZoneId.of("America/Mexico_City").getRules()
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
