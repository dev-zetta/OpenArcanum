// Local analysis output only. Do not commit decompiled retail code or project databases.
// @category OpenArcanum.Oracle
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.SymbolIterator;
import com.google.gson.GsonBuilder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

public class ExportOracleSummary extends GhidraScript {
    @Override public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 1) throw new IllegalArgumentException("Expected private output directory");
        Path output = Path.of(args[0]);
        Files.createDirectories(output);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("program", currentProgram.getName());
        report.put("sha256", currentProgram.getExecutableSHA256());
        report.put("format", currentProgram.getExecutableFormat());
        report.put("language", currentProgram.getLanguageID().toString());
        report.put("compiler", currentProgram.getCompilerSpec().getCompilerSpecID().toString());
        report.put("imageBase", currentProgram.getImageBase().toString());
        report.put("functions", currentProgram.getFunctionManager().getFunctionCount());
        ArrayList<Map<String, Object>> entries = new ArrayList<>();
        DecompInterface decompiler = new DecompInterface();
        try {
            if (!decompiler.openProgram(currentProgram)) throw new IllegalStateException("Cannot open decompiler");
            var addresses = currentProgram.getSymbolTable().getExternalEntryPointIterator();
            while (addresses.hasNext() && entries.size() < 5) {
                Address address = addresses.next();
                Function function = getFunctionAt(address);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("address", address.toString());
                if (function != null) {
                    entry.put("name", function.getName());
                    DecompileResults result = decompiler.decompileFunction(function, 30, monitor);
                    entry.put("decompiled", result.decompileCompleted());
                    if (result.decompileCompleted()) {
                        String filename = "entry-" + address + ".c";
                        Files.writeString(output.resolve(filename), result.getDecompiledFunction().getC());
                        entry.put("file", filename);
                    } else entry.put("error", result.getErrorMessage());
                }
                entries.add(entry);
            }
        } finally { decompiler.dispose(); }
        report.put("entryPoints", entries);
        report.put("note", "Automatic analysis of the supplied binary; recovered function names are not verified semantics.");
        Files.writeString(output.resolve("program-summary.json"), new GsonBuilder().setPrettyPrinting().create().toJson(report) + "\n");
        println("ORACLE_SUMMARY " + report.get("functions") + " functions; " + entries.size() + " entry points");
    }
}
