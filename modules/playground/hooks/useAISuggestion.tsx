import { useState, useCallback, useRef } from "react";


interface AISuggestionsState {
    suggestion: string | null;
    isLoading: boolean;
    position: { line: number; column: number } | null;
    decoration: string[];
    isEnabled: boolean;
}

interface UseAISuggestionsReturn extends AISuggestionsState {
    toggleEnabled: () => void;
    fetchSuggestion: (type: string, editor: unknown) => Promise<void>;
    acceptSuggestion: (editor: unknown, monaco: unknown) => void;
    rejectSuggestion: (editor: unknown) => void;
    clearSuggestion: (editor: unknown) => void;
}

function normalizeSuggestionText(
    rawSuggestion: string,
    fullContent: string,
    cursorLine: number,
    cursorColumn: number
): string {
    let suggestion = rawSuggestion.replace(/\r/g, "").trim();

    if (suggestion.includes("```")) {
        const codeMatch = suggestion.match(/```[\w-]*\n?([\s\S]*?)```/);
        suggestion = (codeMatch?.[1] || suggestion).trim();
    }

    const fileLines = fullContent.split("\n");
    const currentLine = fileLines[cursorLine - 1] || "";
    const typedPrefix = currentLine.slice(0, Math.max(0, cursorColumn - 1));
    const suggestionLines = suggestion.split("\n");

    if (suggestionLines.length > 0 && typedPrefix) {
        const firstLine = suggestionLines[0];
        const maxOverlap = Math.min(typedPrefix.length, firstLine.length);

        // Remove the longest overlap between what is already typed (line suffix)
        // and what the suggestion starts with. Example: "app" + "app.get" -> ".get".
        let overlap = 0;
        for (let i = maxOverlap; i > 0; i--) {
            if (typedPrefix.slice(-i) === firstLine.slice(0, i)) {
                overlap = i;
                break;
            }
        }

        if (overlap > 0) {
            suggestionLines[0] = firstLine.slice(overlap);
        }
    }

    const recentContext = fileLines.slice(Math.max(0, cursorLine - 8), cursorLine).map((l) => l.trimEnd());
    while (suggestionLines.length > 0 && recentContext.includes(suggestionLines[0].trimEnd())) {
        suggestionLines.shift();
    }

    return suggestionLines.join("\n").trim();
}

export const useAISuggestions = (): UseAISuggestionsReturn => {
    const inFlightRef = useRef(false);

    const [state, setState] = useState<AISuggestionsState>({
        suggestion: null,
        isLoading: false,
        position: null,
        decoration: [],
        isEnabled: true,
    });

    const toggleEnabled = useCallback(() => {
        setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
    }, [])

    const fetchSuggestion = useCallback(async (type: string, editor: unknown) => {
        if (inFlightRef.current) {
            return;
        }

        const monacoEditor = editor as {
            getModel?: () => { getValue?: () => string; uri?: { path?: string } } | null;
            getPosition?: () => { lineNumber: number; column: number } | null;
        };

        const model = monacoEditor.getModel?.();
        const cursorAtRequest = monacoEditor.getPosition?.();

        if (!model || !cursorAtRequest) {
            return;
        }

        let isEnabled = true;
        setState((currentState) => {
            isEnabled = currentState.isEnabled;
            if (!currentState.isEnabled) {
                return currentState;
            }
            return { ...currentState, isLoading: true };
        });

        if (!isEnabled) {
            return;
        }

        inFlightRef.current = true;

        try {
            const fileContent = model.getValue?.() ?? "";

            const payload = {
                fileContent,
                cursorLine: cursorAtRequest.lineNumber - 1,
                cursorColumn: cursorAtRequest.column - 1,
                suggestionType: type,
                fileName: model.uri?.path?.split("/").pop(),
            };

            const response = await fetch("/api/code-completion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                throw new Error("AI API returned non-JSON response");
            }

            const data = await response.json();
            const rawSuggestion = typeof data?.suggestion === "string" ? data.suggestion : "";
            const suggestionText = normalizeSuggestionText(
                rawSuggestion,
                fileContent,
                cursorAtRequest.lineNumber,
                cursorAtRequest.column
            );

            if (!suggestionText) {
                setState((prev) => ({ ...prev, suggestion: null, position: null, isLoading: false }));
                return;
            }

            const latestPosition = monacoEditor.getPosition?.() || cursorAtRequest;

            setState((prev) => ({
                ...prev,
                suggestion: suggestionText,
                position: {
                    line: latestPosition.lineNumber,
                    column: latestPosition.column,
                },
                isLoading: false,
            }));
        } catch (error) {
            console.error("Error fetching code suggestion:", error);
            setState((prev) => ({ ...prev, isLoading: false }));
        } finally {
            inFlightRef.current = false;
        }
    }, [])


    const acceptSuggestion = useCallback((editor: unknown, monaco: unknown) => {
        const monacoEditor = editor as {
            deltaDecorations?: (oldDecorations: string[], newDecorations: string[]) => void;
        };

        void monaco;

            setState((currentState) => {
                if (!currentState.suggestion || !currentState.position || !monacoEditor) {
                    return currentState;
                }

                if(monacoEditor && currentState.decoration.length > 0){
                    monacoEditor.deltaDecorations?.(currentState.decoration , [])
                }

                return {
                    ...currentState,
                    suggestion:null,
                    position:null,
                    decoration:[]
                }
            })
    }, [])

    const rejectSuggestion = useCallback((editor: unknown)=>{
            const monacoEditor = editor as {
                deltaDecorations?: (oldDecorations: string[], newDecorations: string[]) => void;
            };
            setState((currentState)=>{
                 if(monacoEditor && currentState.decoration.length > 0){
                    monacoEditor.deltaDecorations?.(currentState.decoration , [])
                }

                return {
                    ...currentState,
                    suggestion:null,
                    position:null,
                    decoration:[]
                }
            })
    },[]);
 
        const clearSuggestion = useCallback((editor: unknown) => {
        const monacoEditor = editor as {
            deltaDecorations?: (oldDecorations: string[], newDecorations: string[]) => void;
        };
    setState((currentState) => {
            if (monacoEditor && currentState.decoration.length > 0) {
                monacoEditor.deltaDecorations?.(currentState.decoration, []);
      }
      return {
        ...currentState,
        suggestion: null,
        position: null,
        decoration: [],
      };
    });
  }, []);


  return {
    ...state,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion
  }

}