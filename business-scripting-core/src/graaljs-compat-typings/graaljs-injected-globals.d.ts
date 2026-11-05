import type {
	DataServicesRpcFacade,
	DocumentService,
	IDocumentV2Serializer,
	JavaInterop,
	KernelDocumentService,
	LinkSpecVerifier,
	QueryService,
	RelationshipLinkService,
	ScriptCaller,
} from './index.js';

/**
 * Bindings that the Java host injects into a script scope before evaluation.
 *
 * `Java` is present in every context. The remaining bindings identify the context: a workflow
 * script gets `dataServicesRpcFacade`, a Data Services script gets the rest. `execution-contexts.ts`
 * distinguishes the contexts by testing which of them are defined, which is why they are declared
 * here rather than imported.
 */
declare global {
	var Java: JavaInterop;

	var dataServicesRpcFacade: DataServicesRpcFacade;
	var documentService: DocumentService;
	var queryService: QueryService;
	var documentV2Serializer: IDocumentV2Serializer;
	var relationshipLinkService: RelationshipLinkService;
	var linkSpecVerifier: LinkSpecVerifier;
	var kernelDocumentService: KernelDocumentService;
	var scriptCaller: ScriptCaller;
	var params: Record<string, unknown>;
}

export {};
