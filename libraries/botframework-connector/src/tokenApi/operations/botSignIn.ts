/*
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as msRest from "@azure/ms-rest-js";
import * as Models from "../models";
import * as Mappers from "../models/botSignInMappers";
import * as Parameters from "../models/parameters";
import { TokenApiClientContext } from "../tokenApiClientContext";

/** Class representing a BotSignIn. */
export class BotSignIn {
  private readonly client: TokenApiClientContext;

  /**
   * Create a BotSignIn.
   * @param {TokenApiClientContext} client Reference to the service client.
   */
  constructor(client: TokenApiClientContext) {
    this.client = client;
  }

  /**
   * @param state
   * @param [options] The optional parameters
   * @returns Promise<Models.BotSignInGetSignInUrlResponse>
   */
  getSignInUrl(state: string, options?: Models.BotSignInGetSignInUrlOptionalParams): Promise<Models.BotSignInGetSignInUrlResponse>;
  /**
   * @param state
   * @param callback The callback
   */
  getSignInUrl(state: string, callback: msRest.ServiceCallback<string>): void;
  /**
   * @param state
   * @param options The optional parameters
   * @param callback The callback
   */
  getSignInUrl(state: string, options: Models.BotSignInGetSignInUrlOptionalParams, callback: msRest.ServiceCallback<string>): void;
  getSignInUrl(state: string, options?: Models.BotSignInGetSignInUrlOptionalParams | msRest.ServiceCallback<string>, callback?: msRest.ServiceCallback<string>): Promise<Models.BotSignInGetSignInUrlResponse> {
    return this.client.sendOperationRequest(
      {
        state,
        options
      },
      getSignInUrlOperationSpec,
      callback) as Promise<Models.BotSignInGetSignInUrlResponse>;
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const getSignInUrlOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "api/botsignin/GetSignInUrl",
  queryParameters: [
    Parameters.state,
    Parameters.codeChallenge,
    Parameters.emulatorUrl,
    Parameters.finalRedirect
  ],
  responses: {
    200: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "String"
        }
      }
    },
    default: {}
  },
  serializer
};
